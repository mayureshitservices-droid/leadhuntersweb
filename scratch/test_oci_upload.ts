import * as os from 'oci-objectstorage';
import common from 'oci-common';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const {
  OCI_USER_OCID,
  OCI_TENANCY_OCID,
  OCI_FINGERPRINT,
  OCI_PRIVATE_KEY,
  OCI_REGION,
  OCI_NAMESPACE,
  OCI_BUCKET_NAME
} = process.env;

async function testUpload() {
  try {
    console.log("Initializing OCI Provider...");
    const provider = new common.SimpleAuthenticationDetailsProvider(
      OCI_TENANCY_OCID!,
      OCI_USER_OCID!,
      OCI_FINGERPRINT!,
      OCI_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      null,
      common.Region.fromRegionId(OCI_REGION!)
    );

    const client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });

    const testFilePath = path.join(process.cwd(), 'scratch', 'test_audio.txt');
    fs.writeFileSync(testFilePath, 'This is a test audio file content.');

    const objectName = `test/test_upload_${Date.now()}.txt`;
    console.log(`Uploading to bucket ${OCI_BUCKET_NAME} in namespace ${OCI_NAMESPACE}...`);

    const putObjectRequest: os.requests.PutObjectRequest = {
      namespaceName: OCI_NAMESPACE!,
      bucketName: OCI_BUCKET_NAME!,
      objectName: objectName,
      putObjectBody: fs.createReadStream(testFilePath),
      contentLength: fs.statSync(testFilePath).size,
      contentType: 'text/plain'
    };

    const response = await client.putObject(putObjectRequest);
    console.log("Upload Success!", response.opcRequestId);

    // Cleanup
    fs.unlinkSync(testFilePath);
  } catch (error) {
    console.error("Upload Failed:", error);
  }
}

testUpload();
