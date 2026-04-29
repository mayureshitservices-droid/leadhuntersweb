import { ociClient } from '../src/config/oci.js';

import * as os from 'oci-objectstorage';
import fs from 'fs';
import path from 'path';

async function testAppOci() {
  console.log("Testing OCI Client from app config...");
  if (!ociClient) {
    console.error("OCI Client is NOT configured (null)!");
    return;
  }
  console.log("OCI Client is initialized.");

  try {
    const bucketName = process.env.OCI_BUCKET_NAME || 'spenca-telecrm-recordings';
    const namespace = process.env.OCI_NAMESPACE || 'bmdqyv5rml4m';
    
    const testFilePath = path.join(process.cwd(), 'scratch', 'app_test_audio.txt');
    fs.writeFileSync(testFilePath, 'App config test content.');

    const objectName = `test/app_test_${Date.now()}.txt`;
    console.log(`Uploading to ${bucketName}...`);

    const putObjectRequest: os.requests.PutObjectRequest = {
      namespaceName: namespace,
      bucketName: bucketName,
      objectName: objectName,
      putObjectBody: fs.createReadStream(testFilePath),
      contentLength: fs.statSync(testFilePath).size,
      contentType: 'text/plain'
    };

    const response = await ociClient.putObject(putObjectRequest);
    console.log("App OCI Client Upload Success!", response.opcRequestId);
    fs.unlinkSync(testFilePath);
  } catch (error) {
    console.error("App OCI Client Upload Failed:", error);
  }
}

testAppOci();
