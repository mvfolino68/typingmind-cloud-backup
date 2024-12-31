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

// Create a new button
const cloudSyncBtn = document.createElement("button");
cloudSyncBtn.setAttribute("data-element-id", "cloud-sync-button");
cloudSyncBtn.className =
  "cursor-default group flex items-center justify-center p-1 text-sm font-medium flex-col group focus:outline-0 focus:text-white text-white/70";

const cloudIconSVG = `
<svg class="w-6 h-6 flex-shrink-0" width="24px" height="24px" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M19 9.76c-.12-3.13-2.68-5.64-5.83-5.64-2.59 0-4.77 1.68-5.53 4.01-.19-.03-.39-.04-.57-.04-2.45 0-4.44 1.99-4.44 4.44 0 2.45 1.99 4.44 4.44 4.44h11.93c2.03 0 3.67-1.64 3.67-3.67 0-1.95-1.52-3.55-3.44-3.65zm-5.83-3.64c2.15 0 3.93 1.6 4.21 3.68l.12.88.88.08c1.12.11 1.99 1.05 1.99 2.19 0 1.21-.99 2.2-2.2 2.2H7.07c-1.64 0-2.97-1.33-2.97-2.97 0-1.64 1.33-2.97 2.97-2.97.36 0 .72.07 1.05.2l.8.32.33-.8c.59-1.39 1.95-2.28 3.45-2.28z" fill="currentColor"></path>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 15.33v-5.33M9.67 12.33L12 14.67l2.33-2.34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
</svg>
`;

const textSpan = document.createElement("span");
textSpan.className =
  "font-normal self-stretch text-center text-xs leading-4 md:leading-none";
textSpan.innerText = "Backup";

const iconSpan = document.createElement("span");
iconSpan.className =
  "block group-hover:bg-white/30 w-[35px] h-[35px] transition-all rounded-lg flex items-center justify-center group-hover:text-white/90";
iconSpan.innerHTML = cloudIconSVG;

cloudSyncBtn.appendChild(iconSpan);
cloudSyncBtn.appendChild(textSpan);

// Attach click handler
cloudSyncBtn.addEventListener("click", function () {
  openSyncModal();
});

function insertCloudSyncButton() {
  const teamsButton = document.querySelector(
    '[data-element-id="workspace-tab-teams"]'
  );

  if (teamsButton && teamsButton.parentNode) {
    teamsButton.parentNode.insertBefore(cloudSyncBtn, teamsButton.nextSibling);
    return true;
  }
  return false;
}

// Try to insert the button immediately
insertCloudSyncButton();

// Set up an observer to keep trying if the first attempt fails
const observer = new MutationObserver((mutations) => {
  if (insertCloudSyncButton()) {
    observer.disconnect();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Also try periodically as a fallback
const maxAttempts = 10;
let attempts = 0;
const interval = setInterval(() => {
  if (insertCloudSyncButton() || attempts >= maxAttempts) {
    clearInterval(interval);
  }
  attempts++;
}, 1000);
