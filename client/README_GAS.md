# Google Sheets Backend Setup

To enable real database functionality using Google Sheets, follow these steps:

1.  **Create a Google Sheet**
    *   Create a new Google Sheet.
    *   Rename the first sheet tab to `Users`.
    *   Add headers to `Users`: `Email`, `Password`, `Name`, `Role`.
    *   Add a test user row: `admin@lgu.gov.ph`, `admin`, `Admin User`, `admin`.

2.  **Create the Google Apps Script**
    *   Go to **Extensions > Apps Script** in your Google Sheet.
    *   Delete any code in `Code.gs`.
    *   Copy the content from `scripts/GAS_CODE.js` in this project and paste it into `Code.gs`.
    *   Save the project (Ctrl+S).

3.  **Deploy as Web App**
    *   Click the **Deploy** button (top right) > **New deployment**.
    *   Click the gear icon > **Web app**.
    *   **Description**: "RCD Backend".
    *   **Execute as**: "Me" (your email).
    *   **Who has access**: "Anyone". (Important! This allows your app to access it).
    *   Click **Deploy**.
    *   Authorize the script when prompted.

4.  **Connect to React App**
    *   Copy the **Web app URL** (starts with `https://script.google.com/macros/s/...`).
    *   Open `.env` in the `client` folder.
    *   Add/Update:
        ```env
        VITE_GOOGLE_SCRIPT_URL=your_copied_url_here
        ```
    *   Restart the development server (`npm run dev`).

Now your app will read/write directly to the Google Sheet!
