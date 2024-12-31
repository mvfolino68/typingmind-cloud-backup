let backupIntervalRunning = false;
let wasImportSuccessful = false;
let isExportInProgress = false;
let isImportInProgress = false;
let isSnapshotInProgress = false;
const TIME_BACKUP_INTERVAL = 15; //minutes
const TIME_BACKUP_FILE_PREFIX = `T-${TIME_BACKUP_INTERVAL}`;
const BACKUP_FOLDER_NAME = "TypingMindBackup";
let gapi;
let tokenClient;
let backupFolderId = null;

// Client ID from the Developer Console
const CLIENT_ID =
  "102506089690-su2s10ijjprfcb9b8sjne1nb3ogo4i6l.apps.googleusercontent.com";

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

// Authorization scopes required by the API
const SCOPES = "https://www.googleapis.com/auth/drive.file";

(async function checkDOMOrRunBackup() {
  if (document.readyState === "complete") {
    await handleDOMReady();
  } else {
    window.addEventListener("load", handleDOMReady);
  }
})();

async function handleDOMReady() {
  window.removeEventListener("load", handleDOMReady);
  try {
    // Load all required libraries first
    console.log("Loading required libraries...");
    await Promise.all([loadDexie(), loadJSZip()]);
    
    // Load Google auth separately since it requires sequential steps
    console.log("Loading Google Auth...");
    await loadGoogleAuth();
    
    console.log("Setting up backup folder...");
    await setupBackupFolder();
    
    console.log("Checking for existing backups...");
    var importSuccessful = await checkAndImportBackup();
    
    const storedSuffix = localStorage.getItem("last-daily-backup-in-gdrive");
    const today = new Date();
    const currentDateSuffix = `${today.getFullYear()}${String(
      today.getMonth() + 1
    ).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const currentTime = new Date().toLocaleString();
    const lastSync = localStorage.getItem("last-cloud-sync");
    var element = document.getElementById("last-sync-msg");

    if (lastSync && importSuccessful) {
      if (element !== null) {
        element.innerText = `Last sync done at ${currentTime}`;
        element = null;
      }
      if (!storedSuffix || currentDateSuffix > storedSuffix) {
        await handleBackupFiles();
      }
      startBackupInterval();
      setupStorageMonitoring();
    } else if (!backupIntervalRunning) {
      startBackupInterval();
      setupStorageMonitoring();
    }
    
    console.log("Google Drive backup extension initialized successfully!");
  } catch (err) {
    console.error("Error in handleDOMReady:", err);
  }
}
