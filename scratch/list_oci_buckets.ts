import * as os from 'oci-objectstorage';
import common from 'oci-common';
import 'dotenv/config';

const {
  OCI_USER_OCID,
  OCI_TENANCY_OCID,
  OCI_FINGERPRINT,
  OCI_PRIVATE_KEY,
  OCI_REGION,
  OCI_NAMESPACE
} = process.env;

async function listBuckets() {
  try {
    const provider = new common.SimpleAuthenticationDetailsProvider(
      OCI_TENANCY_OCID!,
      OCI_USER_OCID!,
      OCI_FINGERPRINT!,
      OCI_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      null,
      common.Region.fromRegionId(OCI_REGION!)
    );

    const client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });

    console.log(`Listing buckets in namespace ${OCI_NAMESPACE}...`);
    const listBucketsRequest: os.requests.ListBucketsRequest = {
      namespaceName: OCI_NAMESPACE!,
      compartmentId: OCI_TENANCY_OCID! // Usually buckets are in a compartment, often tenancy OCID works for root
    };

    const response = await client.listBuckets(listBucketsRequest);
    console.log("Buckets found:", response.items.map(b => b.name));
  } catch (error) {
    console.error("List Buckets Failed:", error);
  }
}

listBuckets();
