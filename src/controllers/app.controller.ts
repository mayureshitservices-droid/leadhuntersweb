import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AppController {
  getVersion = async (req: Request, res: Response) => {
    try {
      // Try finding it in the src directory relative to the project root
      let configPath = path.join(process.cwd(), 'src/config/app-version.json');
      
      // Fallback in case process.cwd() is different
      if (!fs.existsSync(configPath)) {
        configPath = path.join(__dirname, '../../src/config/app-version.json');
      }

      const configData = fs.readFileSync(configPath, 'utf8');
      const versionInfo = JSON.parse(configData);
      res.json(versionInfo);
    } catch (error) {
      console.error('Error reading app version:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
