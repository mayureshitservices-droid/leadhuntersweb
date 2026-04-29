import 'dotenv/config';
import { ociClient } from '../src/config/oci.js';
import * as os from 'oci-objectstorage';

async function makeBucketPublic() {
  console.log("Connecting to OCI to update bucket visibility...");
  if (!ociClient) {
    console.error("OCI Client is NOT configured!");
    return;
  }

  try {
    const bucketName = process.env.OCI_BUCKET_NAME || 'spenca-telecrm-recordings';
    const namespace = process.env.OCI_NAMESPACE || 'bmdqyv5rml4m';
    
    // Strip quotes just like we did in the app
    const cleanBucket = bucketName.replace(/^"|"$/g, '');
    const cleanNamespace = namespace.replace(/^"|"$/g, '');

    console.log(`Setting bucket ${cleanBucket} to Public (ObjectRead)...`);

    const updateBucketRequest: os.requests.UpdateBucketRequest = {
      namespaceName: cleanNamespace,
      bucketName: cleanBucket,
      updateBucketDetails: {
        publicAccessType: os.models.UpdateBucketDetails.PublicAccessType.ObjectRead
      }
    };

    const response = await ociClient.updateBucket(updateBucketRequest);
    console.log("Success! Bucket is now PUBLIC.");
    console.log("Public Access Type:", response.bucket.publicAccessType);
    
  } catch (error) {
    console.error("Failed to update bucket:", error);
  }
}

makeBucketPublic();
