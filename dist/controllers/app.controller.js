import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class AppController {
    getVersion = async (req, res) => {
        try {
            // Try finding it in the src directory relative to the project root
            // Try dist first (Production), then src (Development)
            let configPath = path.join(process.cwd(), 'dist/config/app-version.json');
            if (!fs.existsSync(configPath)) {
                configPath = path.join(process.cwd(), 'src/config/app-version.json');
            }
            if (!fs.existsSync(configPath)) {
                configPath = path.join(__dirname, '../../src/config/app-version.json');
            }
            const configData = fs.readFileSync(configPath, 'utf8');
            const versionInfo = JSON.parse(configData);
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.json(versionInfo);
        }
        catch (error) {
            console.error('Error reading app version:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}
