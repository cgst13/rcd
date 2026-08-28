# Reports of Collections and Deposits (RCD) System - LGU Concepcion

This is a modern web application for the LGU Concepcion, Romblon.

## Tech Stack
- React (Vite)
- TypeScript
- Tailwind CSS (v4)
- React Router DOM (Navigation)
- Lucide React (Icons)
- Google Sheets API (as Database)

## Setup

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

## Google Sheets Integration

To connect a real Google Sheet, you need a **Google Cloud API Key** with **Google Sheets API** enabled.

1.  **Create Google Sheet**:
    - Create a new Google Sheet.
    - Rename the first tab to `Users`.
    - Add headers in the first row: `Email`, `Password`, `Name`, `Role`.
    - Add a test user in row 2: `test@example.com`, `password123`, `Test User`, `collector`.
    - **Share** the sheet: Make it "Anyone with the link can view" (Reader) OR ensure your API Key has access.

2.  **Get Credentials**:
    - Go to [Google Cloud Console](https://console.cloud.google.com/).
    - Create a project.
    - Enable **Google Sheets API**.
    - Create Credentials -> **API Key**.

3.  **Configure Environment**:
    - Create a `.env` file in the `client` folder (root of the frontend).
    - Add your keys:
    ```env
    VITE_GOOGLE_SHEET_ID=your_spreadsheet_id_from_url
    VITE_GOOGLE_API_KEY=your_google_cloud_api_key
    ```

## Default Login (Mock)
If no `.env` variables are provided, the app falls back to this mock user:
- Email: `admin@lgu.gov.ph`
- Password: `admin`
