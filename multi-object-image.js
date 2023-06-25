const { ImageAnnotatorClient } = require('@google-cloud/vision');
const path = require('path');
const fs = require('fs');
const htmlFile = './views/imageResults.html';

// Specify the path to your JSON key file
const keyFilePath = path.resolve(__dirname, './access_key/vision-AI.json');

// Create a client instance for the Google Cloud Vision API
const client = new ImageAnnotatorClient({
  keyFilename: keyFilePath
});

// Function to analyze an image file
async function analyzeImage(filePath, folderPath) {
  try {
    const [result] = await client.objectLocalization(filePath);
    const objects = result.localizedObjectAnnotations;
    const imageFileName = path.basename(filePath);
    const imagePath = `./photo_gallery/${folderPath}/${imageFileName}`;
    const offlineImagePath = `file:///${path.resolve(imagePath)}`;
    const objectLabels = objects.map((obj) => obj.name).join(', ');
    return {
      file: filePath,
      folder: folderPath,
      labels: objectLabels,
      image: `<img src="${offlineImagePath}" alt="${objectLabels}" width="200">`
    };
  } catch (error) {
    const imageFileName = path.basename(filePath);
    const imagePath = `./photo_gallery/${folderPath}/${imageFileName}`;
    const offlineImagePath = `file:///${path.resolve(imagePath)}`;
    return {
      file: filePath,
      folder: folderPath,
      labels: 'Not able to recognize',
      image: `<img src="${offlineImagePath}" alt="Not able to recognize" width="200">`
    };
  }
}

// Function to get all image files from a folder
async function getAllImageFiles(folderPath) {
  const dirents = await fs.promises.readdir(folderPath, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(folderPath, dirent.name);
      return dirent.isDirectory() ? getAllImageFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}

// Function to validate file format as jpg or png
function validateImageFileFormat(filePath) {
  const fileExtension = path.extname(filePath).toLowerCase();
  return fileExtension === '.jpg' || fileExtension === '.jpeg' || fileExtension === '.png';
}

// Function to generate the HTML table for a specific folder
function generateTable(folderPath, results) {
  const tableRows = results
    .map(
      (result) =>
        `<tr><td>${result.image}</td><td>${result.labels}</td></tr>`
    )
    .join('');

  return `
    <h3>${folderPath}</h3>
    <table>
      <tr>
        <th>Image</th>
        <th>Labels</th>
      </tr>
      ${tableRows}
    </table>
  `;
}

// Path to your images folder
const mainFolderPath = './photo_gallery';

// Read all image files from the main folder and subfolders
getAllImageFiles(mainFolderPath).then(async (imageFiles) => {
  // Filter image files by format (jpg or png)
  const validImageFiles = imageFiles.filter(validateImageFileFormat);

  // Analyze each image file
  const results = await Promise.all(
    validImageFiles.map(async (file) => {
      const folderPath = path.relative(mainFolderPath, path.dirname(file));
      return await analyzeImage(file, folderPath);
    })
  );

  // Group the results by folder
  const folderResultsMap = new Map();
  results.forEach((result) => {
    if (!folderResultsMap.has(result.folder)) {
      folderResultsMap.set(result.folder, []);
    }
    folderResultsMap.get(result.folder).push(result);
  });

  // Generate HTML tables for each folder
  const folderTables = [...folderResultsMap].map(([folderPath, folderResults]) => generateTable(folderPath, folderResults));

  // HTML template
  const htmlTemplate = `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        table {
          border-collapse: collapse;
          width: 50%;
        }
        th, td {
          text-align: center;
          padding: 8px;
          font-weight: bold;
        }
        th {
          background-color: #f2f2f2;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        h3 {
          background: black;
          color: white;
          width: 50%;
          text-align: center;
        }
      </style>
    </head>
    <body>
      ${folderTables.join('')}
    </body>
  </html>`;

  // Write the HTML content to a file
  fs.writeFile(htmlFile, htmlTemplate, (error) => {
    if (error) {
      console.error('Error writing HTML file:', error);
    } else {
      console.log('HTML file created: imageResults.html');
    }
  });
}).catch((error) => {
  console.error('Error reading image files:', error);
});
