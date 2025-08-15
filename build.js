const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read manifest to get version
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = manifest.version;

// Clean and create dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
}
fs.mkdirSync('dist');

// Files to include in the extension package
const filesToCopy = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'popup.html',
  'popup.js',
  'popup.css',
  'lib/',
  'icons/'
];

// Copy files to dist
filesToCopy.forEach(file => {
  const srcPath = path.join('.', file);
  const destPath = path.join('dist', file);
  
  if (fs.existsSync(srcPath)) {
    if (fs.statSync(srcPath).isDirectory()) {
      // Copy directory recursively
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`Copied: ${file}`);
  } else {
    console.warn(`Warning: ${file} not found, skipping...`);
  }
});

// Create zip file with version
const zipFileName = `schwab-tax-lot-extractor-v${version}.zip`;
console.log(`Creating ${zipFileName}...`);

try {
  execSync(`cd dist && zip -r ../${zipFileName} .`, { stdio: 'inherit' });
  console.log(`✅ Build complete! Created ${zipFileName}`);
  console.log(`📦 Ready to upload to Chrome Web Store`);
} catch (error) {
  console.error('❌ Error creating zip file:', error.message);
  process.exit(1);
}