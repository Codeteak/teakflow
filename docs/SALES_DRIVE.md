# Sales payment workbook on Google Drive

Accounts keep Excel/Sheets **exactly as today**. Teakflow reads them and writes four cells: STATUS, PAYMENT MODE, DATE, REFERNCE NO. Header matching ignores case (`PLACE` or `place`).

Row 1 should be:

`ID · SHOP NAME · PLACE · AMOUNT · GST · STATUS · PAYMENT MODE · DATE · REFERNCE NO`

Each **calendar year** is a **separate file** in the same folder. Month tabs stay inside that year’s file (`june`, `july`, …). In January you collect December, so the app opens **last year’s** file.

Folder:

```text
salesyaadro@gmail.com
  sales
    yaadro sales
      monthly payment 2026
      monthly payment 2027   ← add this on 1 Jan 2027 (copy 2026, new month amounts)
```

File name must contain `monthly payment 2026` (year at the end).

---

## One-time Google setup (you do this)

1. Upload the current workbook into `sales / yaadro sales`.
2. Right-click → **Open with Google Sheets** (keep the same tabs and the same header row, including **REFERNCE NO**).
3. Rename the Sheet to **`monthly payment 2026`** (use the real year).
4. Google Cloud Console (same project as Meet is fine, or a new one):
   - Enable **Google Sheets API** and **Google Drive API**.
   - Create a **service account**.
   - Download the JSON key.
5. Open the JSON, copy the `client_email` (looks like `teakflow-sales@….iam.gserviceaccount.com`).
6. In Drive, share **`yaadro sales` folder** with that email as **Editor**.
7. Copy the folder ID from the folder URL: `https://drive.google.com/drive/folders/THIS_PART`.
8. Put this in the workspace `.env`. The JSON may be several lines, starting with `{` and ending with `}` on its own line, then `GOOGLE_SALES_FOLDER_ID`.

```text
GOOGLE_SALES_SA_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com",...}
GOOGLE_SALES_FOLDER_ID=the_folder_id_from_step_7
```

Optional, if Drive search is flaky, pin IDs (from each Sheet URL `/spreadsheets/d/ID/`):

```text
GOOGLE_SALES_SPREADSHEET_IDS={"2026":"sheet-id-for-2026","2027":"sheet-id-for-2027"}
```

Restart the API after saving `.env`.

---

## Every new year (you do this)

1. In `yaadro sales`, **File → Make a copy** of last year’s Sheet.
2. Name it **`monthly payment 2027`** (new year).
3. Keep tab names (`january` … `december` or `june` … `december` as you already use).
4. Paste the new year’s shop amounts; **do not rename columns**.
5. Share is already on the folder, so the new file is visible to the service account.
6. If you use `GOOGLE_SALES_SPREADSHEET_IDS`, add the new year’s Sheet ID.

In **September** the app opens tab **`august`**. In **January 2027** it opens **`december`** inside **`monthly payment 2026`**.

Collection: pick a shop from the month tab to load that Excel row. ID, SHOP NAME, PLACE, AMOUNT, and GST stay as accounts entered them. Teakflow only writes **STATUS, PAYMENT MODE, DATE, REFERNCE NO**. Executives use the shop picker (not the full table). Admin, Manager, and Lead also get the full table. **Refresh from Drive** re-reads the Sheet. Collection edits and daily received payments are stored in Postgres as well as Drive.

Teakflow never creates the yearly file by itself. Accounts own the file; the app only updates collection status.
