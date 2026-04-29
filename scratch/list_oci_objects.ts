import 'dotenv/config';
import { ociClient } from '../src/config/oci.js';
import * as os from 'oci-objectstorage';

async function listObjects() {
  console.log("Checking OCI Bucket for recent uploads...");
  if (!ociClient) {
    console.error("OCI Client is NOT configured (null)!");
    return;
  }

  try {
    const bucketName = process.env.OCI_BUCKET_NAME || 'spenca-telecrm-recordings';
    const namespace = process.env.OCI_NAMESPACE || 'bmdqyv5rml4m';
    
    console.log(`Listing objects in bucket: ${bucketName}...`);

    const listObjectsRequest: os.requests.ListObjectsRequest = {
      namespaceName: namespace,
      bucketName: bucketName,
      prefix: "records/",
      limit: 1000,
      fields: "timeCreated,size,md5"
    };

    const response = await ociClient.listObjects(listObjectsRequest);
    const objects = response.listObjects.objects || [];
    
    if (objects.length === 0) {
      console.log("No objects found in the bucket.");
    } else {
      // Sort by time created, most recent first
      objects.sort((a, b) => {
        if (!a.timeCreated || !b.timeCreated) return 0;
        return new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime();
      });
      
      console.log(`Found ${objects.length} objects. Most recent:`);
      objects.slice(0, 5).forEach(obj => {
        console.log(`- Name: ${obj.name}`);
        console.log(`  Size: ${obj.size} bytes`);
        console.log(`  Created: ${obj.timeCreated}`);
      });
    }
  } catch (error) {
    console.error("Failed to list objects:", error);
  }
}

listObjects();
