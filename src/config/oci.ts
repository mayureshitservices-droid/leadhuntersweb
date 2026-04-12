import common from 'oci-common';
import os from 'oci-objectstorage';

const {
  OCI_USER_OCID,
  OCI_TENANCY_OCID,
  OCI_FINGERPRINT,
  OCI_PRIVATE_KEY,
  OCI_REGION
} = process.env;

let provider: common.AuthenticationDetailsProvider | null = null;
let client: os.ObjectStorageClient | null = null;

try {
  if (OCI_USER_OCID && OCI_TENANCY_OCID && OCI_PRIVATE_KEY && OCI_REGION) {
    provider = new common.SimpleAuthenticationDetailsProvider(
      OCI_TENANCY_OCID,
      OCI_USER_OCID,
      OCI_FINGERPRINT || '',
      OCI_PRIVATE_KEY.replace(/\\n/g, '\n'), // Fix escaped newlines in env
      null,
      common.Region.fromRegionId(OCI_REGION)
    );

    client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });
  } else {
    console.warn("OCI credentials missing. Record uploads will fail.");
  }
} catch (e) {
  console.error("Failed to initialize OCI provider:", e);
}

export const ociProvider = provider;
export const ociClient = client;
