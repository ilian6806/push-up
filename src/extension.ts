import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Logger } from "./logger";
import { StatusBar } from "./status-bar";
import {
  PushUpConfig,
  findConfig,
  loadConfig,
  createConfigWatcher,
  invalidateAllConfigs,
  scaffoldConfig,
} from "./config";
import { IgnoreChecker } from "./ignore";
import { IUploader } from "./uploader";
import { SftpUploader } from "./sftp-uploader";
import { FtpUploader } from "./ftp-uploader";
import { toRemotePath, toLocalPath, toRelativePath, collectFiles, collectRemoteFiles } from "./utils";
import { FolderWatcher } from "./folder-watcher";

let logger: Logger;
let statusBar: StatusBar;
const uploaderPool = new Map<string, IUploader>();
const ignorePool = new Map<string, IgnoreChecker>();
const passwordCache = new Map<string, string>();
const folderWatchers = new Map<string, FolderWatcher>();

export function activate(context: vscode.ExtensionContext): void {
  logger = new Logger();
  statusBar = new StatusBar();

  const configWatcher = createConfigWatcher();
  configWatcher.onDidChange((uri) => {
    ignorePool.clear();
    rebuildFolderWatcher(uri.fsPath);
  });
  configWatcher.onDidCreate((uri) => {
    ignorePool.clear();
    rebuildFolderWatcher(uri.fsPath);
  });
  configWatcher.onDidDelete((uri) => {
    ignorePool.clear();
    destroyFolderWatcher(uri.fsPath);
  });

  context.subscriptions.push(
    logger,
    statusBar,
    configWatcher,
    vscode.commands.registerCommand("pushup.init", cmdInit),
    vscode.commands.registerCommand("pushup.uploadFile", cmdUploadFile),
    vscode.commands.registerCommand("pushup.downloadFile", cmdDownloadFile),
    vscode.commands.registerCommand("pushup.uploadFolder", cmdUploadFolder),
    vscode.commands.registerCommand("pushup.downloadFolder", cmdDownloadFolder),
    vscode.commands.registerCommand("pushup.showOutput", () => logger.show()),
    vscode.workspace.onDidSaveTextDocument(onDocumentSave)
  );

  setupFolderWatchers();
  logger.info("PushUp activated.");
}

export function deactivate(): void {
  for (const watcher of folderWatchers.values()) {
    watcher.dispose();
  }
  folderWatchers.clear();
  for (const uploader of uploaderPool.values()) {
    uploader.disconnect().catch(() => {});
  }
  uploaderPool.clear();
  ignorePool.clear();
  passwordCache.clear();
  invalidateAllConfigs();
}

// ── On Save ──────────────────────────────────────────────────────

async function onDocumentSave(doc: vscode.TextDocument): Promise<void> {
  const filePath = doc.uri.fsPath;
  const configPath = findConfig(filePath);
  if (!configPath) {
    return;
  }

  let config: PushUpConfig;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    logger.error(`Failed to load config: ${err}`);
    return;
  }

  if (!config.uploadOnSave) {
    return;
  }

  // Skip if the watcher already uploaded this file recently
  const watcher = folderWatchers.get(config.configPath);
  if (watcher && watcher.wasRecentlyUploaded(filePath)) {
    return;
  }

  const relative = toRelativePath(filePath, config);
  const checker = getIgnoreChecker(config);
  if (checker.isIgnored(relative)) {
    return;
  }

  const remotePath = toRemotePath(filePath, config);
  const remoteDir = path.posix.dirname(remotePath);

  try {
    statusBar.uploading();
    const uploader = await getUploader(config);
    await uploader.ensureDir(remoteDir);
    await uploader.uploadFile(filePath, remotePath);
    logger.info(`Uploaded: ${relative} → ${remotePath}`);
    statusBar.success();
  } catch (err) {
    handleUploadError(config, `Upload failed for ${relative}: ${err}`);
  }
}

// ── Commands ─────────────────────────────────────────────────────

async function cmdInit(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage("PushUp: No workspace folder open.");
    return;
  }

  let folder: vscode.WorkspaceFolder;
  if (folders.length === 1) {
    folder = folders[0];
  } else {
    const picked = await vscode.window.showWorkspaceFolderPick({
      placeHolder: "Select folder for .pushup.json",
    });
    if (!picked) {
      return;
    }
    folder = picked;
  }

  const configFile = path.join(folder.uri.fsPath, ".pushup.json");
  if (fs.existsSync(configFile)) {
    vscode.window.showWarningMessage("PushUp: .pushup.json already exists in this folder.");
    const doc = await vscode.workspace.openTextDocument(configFile);
    await vscode.window.showTextDocument(doc);
    return;
  }

  fs.writeFileSync(configFile, scaffoldConfig(), "utf-8");
  const doc = await vscode.workspace.openTextDocument(configFile);
  await vscode.window.showTextDocument(doc);
  logger.info(`Created ${configFile}`);
}

async function cmdUploadFile(uri?: vscode.Uri): Promise<void> {
  const filePath = resolveFileUri(uri);
  if (!filePath) {
    return;
  }

  const configPath = findConfig(filePath);
  if (!configPath) {
    vscode.window.showErrorMessage("PushUp: No .pushup.json found for this file.");
    return;
  }

  let config: PushUpConfig;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    vscode.window.showErrorMessage(`PushUp: ${err}`);
    return;
  }

  const remotePath = toRemotePath(filePath, config);
  const remoteDir = path.posix.dirname(remotePath);
  const relative = toRelativePath(filePath, config);

  try {
    statusBar.uploading();
    const uploader = await getUploader(config);
    await uploader.ensureDir(remoteDir);
    await uploader.uploadFile(filePath, remotePath);
    logger.info(`Uploaded: ${relative} → ${remotePath}`);
    statusBar.success();
  } catch (err) {
    handleUploadError(config, `Upload failed for ${relative}: ${err}`);
  }
}

async function cmdDownloadFile(uri?: vscode.Uri): Promise<void> {
  const filePath = resolveFileUri(uri);
  if (!filePath) {
    return;
  }

  const configPath = findConfig(filePath);
  if (!configPath) {
    vscode.window.showErrorMessage("PushUp: No .pushup.json found for this file.");
    return;
  }

  let config: PushUpConfig;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    vscode.window.showErrorMessage(`PushUp: ${err}`);
    return;
  }

  const remotePath = toRemotePath(filePath, config);
  const relative = toRelativePath(filePath, config);
  const localDir = path.dirname(filePath);

  try {
    statusBar.uploading();
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const uploader = await getUploader(config);
    await uploader.downloadFile(remotePath, filePath);
    logger.info(`Downloaded: ${remotePath} → ${relative}`);
    statusBar.success();
  } catch (err) {
    handleUploadError(config, `Download failed for ${relative}: ${err}`);
  }
}

async function cmdUploadFolder(uri?: vscode.Uri): Promise<void> {
  const folderPath = resolveFolderUri(uri);
  if (!folderPath) {
    return;
  }

  const configPath = findConfig(folderPath, true);
  if (!configPath) {
    vscode.window.showErrorMessage("PushUp: No .pushup.json found for this folder.");
    return;
  }

  let config: PushUpConfig;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    vscode.window.showErrorMessage(`PushUp: ${err}`);
    return;
  }

  const checker = getIgnoreChecker(config);
  const files = collectFiles(folderPath, config, checker);
  if (files.length === 0) {
    vscode.window.showInformationMessage("PushUp: No files to upload.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PushUp: Uploading folder",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const uploader = await getUploader(config);
        for (let i = 0; i < files.length; i++) {
          if (token.isCancellationRequested) {
            logger.info("Upload cancelled.");
            return;
          }
          const file = files[i];
          const remotePath = toRemotePath(file, config);
          const remoteDir = path.posix.dirname(remotePath);
          await uploader.ensureDir(remoteDir);
          await uploader.uploadFile(file, remotePath);
          const relative = toRelativePath(file, config);
          logger.info(`Uploaded: ${relative} → ${remotePath}`);
          progress.report({
            message: `${i + 1}/${files.length}`,
            increment: 100 / files.length,
          });
        }
        statusBar.success();
        vscode.window.showInformationMessage(`PushUp: Uploaded ${files.length} file(s).`);
      } catch (err) {
        handleUploadError(config, `Folder upload failed: ${err}`);
      }
    }
  );
}

async function cmdDownloadFolder(uri?: vscode.Uri): Promise<void> {
  const folderPath = resolveFolderUri(uri);
  if (!folderPath) {
    return;
  }

  const configPath = findConfig(folderPath, true);
  if (!configPath) {
    vscode.window.showErrorMessage("PushUp: No .pushup.json found for this folder.");
    return;
  }

  let config: PushUpConfig;
  try {
    config = loadConfig(configPath);
  } catch (err) {
    vscode.window.showErrorMessage(`PushUp: ${err}`);
    return;
  }

  const remoteBase = toRemotePath(folderPath, config);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PushUp: Downloading folder",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        const uploader = await getUploader(config);
        const files = await collectRemoteFiles(uploader, remoteBase);
        if (files.length === 0) {
          vscode.window.showInformationMessage("PushUp: No files to download.");
          return;
        }

        for (let i = 0; i < files.length; i++) {
          if (token.isCancellationRequested) {
            logger.info("Download cancelled.");
            return;
          }
          const remotePath = files[i];
          const localPath = toLocalPath(remotePath, config);
          const localDir = path.dirname(localPath);
          if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
          }
          await uploader.downloadFile(remotePath, localPath);
          const relative = toRelativePath(localPath, config);
          logger.info(`Downloaded: ${remotePath} → ${relative}`);
          progress.report({
            message: `${i + 1}/${files.length}`,
            increment: 100 / files.length,
          });
        }
        statusBar.success();
        vscode.window.showInformationMessage(`PushUp: Downloaded ${files.length} file(s).`);
      } catch (err) {
        handleUploadError(config, `Folder download failed: ${err}`);
      }
    }
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function resolveFileUri(uri?: vscode.Uri): string | undefined {
  if (uri) {
    return uri.fsPath;
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return editor.document.uri.fsPath;
  }
  vscode.window.showErrorMessage("PushUp: No file selected.");
  return undefined;
}

function resolveFolderUri(uri?: vscode.Uri): string | undefined {
  if (uri) {
    return uri.fsPath;
  }
  vscode.window.showErrorMessage("PushUp: No folder selected.");
  return undefined;
}

function getIgnoreChecker(config: PushUpConfig): IgnoreChecker {
  let checker = ignorePool.get(config.configPath);
  if (!checker) {
    checker = new IgnoreChecker(config.ignore);
    ignorePool.set(config.configPath, checker);
  }
  return checker;
}

async function ensurePassword(config: PushUpConfig): Promise<string | undefined> {
  if (config.password) {
    return config.password;
  }
  if (config.protocol === "sftp" && config.privateKeyPath) {
    return undefined;
  }
  const cached = passwordCache.get(config.configPath);
  if (cached) {
    return cached;
  }
  const pw = await vscode.window.showInputBox({
    prompt: `Enter password for ${config.username}@${config.host}`,
    password: true,
    ignoreFocusOut: true,
  });
  if (pw !== undefined) {
    passwordCache.set(config.configPath, pw);
  }
  return pw;
}

async function getUploader(config: PushUpConfig): Promise<IUploader> {
  const existing = uploaderPool.get(config.configPath);
  if (existing && existing.isConnected()) {
    return existing;
  }

  const password = await ensurePassword(config);
  let uploader: IUploader;
  if (config.protocol === "sftp") {
    uploader = new SftpUploader(config, password);
  } else {
    uploader = new FtpUploader(config, password);
  }

  await uploader.connect();
  uploaderPool.set(config.configPath, uploader);
  return uploader;
}

function handleUploadError(config: PushUpConfig, message: string): void {
  statusBar.error();
  logger.error(message);
  vscode.window.showErrorMessage(`PushUp: ${message}`);
  // Evict broken uploader from pool
  const uploader = uploaderPool.get(config.configPath);
  if (uploader) {
    uploader.disconnect().catch(() => {});
    uploaderPool.delete(config.configPath);
  }
}

// ── Folder Watchers ─────────────────────────────────────────────

function setupFolderWatchers(): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return;
  }
  for (const folder of folders) {
    const configPath = findConfig(folder.uri.fsPath, true);
    if (configPath) {
      createFolderWatcher(configPath);
    }
  }
}

function createFolderWatcher(configPath: string): void {
  let config: PushUpConfig;
  try {
    config = loadConfig(configPath);
  } catch {
    return;
  }

  if (config.watchFolders.length === 0) {
    return;
  }

  const watcher = new FolderWatcher({
    config,
    uploadFn: (filePath) => uploadFileFromWatcher(filePath, config),
    deleteFn: (filePath) => deleteFileFromWatcher(filePath, config),
    getIgnoreChecker: () => getIgnoreChecker(config),
    logger,
  });

  watcher.start();
  folderWatchers.set(configPath, watcher);
}

async function uploadFileFromWatcher(filePath: string, config: PushUpConfig): Promise<boolean> {
  const remotePath = toRemotePath(filePath, config);
  const remoteDir = path.posix.dirname(remotePath);
  try {
    statusBar.uploading();
    const uploader = await getUploader(config);
    await uploader.ensureDir(remoteDir);
    await uploader.uploadFile(filePath, remotePath);
    statusBar.success();
    return true;
  } catch (err) {
    handleUploadError(config, `Watch upload failed for ${toRelativePath(filePath, config)}: ${err}`);
    return false;
  }
}

async function deleteFileFromWatcher(filePath: string, config: PushUpConfig): Promise<boolean> {
  const remotePath = toRemotePath(filePath, config);
  try {
    const uploader = await getUploader(config);
    await uploader.deleteFile(remotePath);
    return true;
  } catch (err) {
    handleUploadError(config, `Watch delete failed for ${toRelativePath(filePath, config)}: ${err}`);
    return false;
  }
}

function rebuildFolderWatcher(configPath: string): void {
  destroyFolderWatcher(configPath);
  createFolderWatcher(configPath);
}

function destroyFolderWatcher(configPath: string): void {
  const existing = folderWatchers.get(configPath);
  if (existing) {
    existing.dispose();
    folderWatchers.delete(configPath);
  }
}

