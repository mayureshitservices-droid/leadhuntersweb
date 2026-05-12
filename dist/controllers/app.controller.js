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
                console.warn(`[AppController] Config file NOT FOUND at: ${configPath}. Returning default safety version.`);
                return res.json({
                    versionCode: 1,
                    versionName: "1.0.0",
                    downloadUrl: "",
                    mandatory: false
                });
            }
            const configData = fs.readFileSync(configPath, 'utf8');
            const versionInfo = JSON.parse(configData);
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.json(versionInfo);
        }
        catch (error) {
            console.error('Error reading app version:', error);
            res.json({
                versionCode: 1,
                versionName: "1.0.0",
                downloadUrl: "",
                mandatory: false
            });
        }
    };
}
