import { browser } from '@wdio/globals';
import * as cloudinary from 'cloudinary';

/** Optional overrides; values fall back to `E2E_*` environment variables. */
export type CloudinarySDKCredentials = {
    cloud_name?: string;
    api_key?: string;
    api_secret?: string;
};

/**
 * Cloudinary sdk, see more here:
 * https://cloudinary.com/documentation/node_integration
 */
export class CloudinarySDK {
    public constructor(credentials?: CloudinarySDKCredentials) {
        const cloud_name = credentials?.cloud_name ?? process.env.E2E_CLOUD;
        const api_key = credentials?.api_key ?? process.env.E2E_API_KEY;
        const api_secret = credentials?.api_secret ?? process.env.E2E_API_SECRET;
        if (!cloud_name || !api_key || !api_secret) {
            throw new Error(
                'CloudinarySDK requires cloud_name, api_key, and api_secret (via optional parameters or E2E_CLOUD, E2E_API_KEY, E2E_API_SECRET in process.env).'
            );
        }
        cloudinary.v2.config({
            cloud_name,
            api_key,
            api_secret,
            upload_prefix: 'https://api.cloudinary.com',
            secure: true,
        });
    }

    /**
     * Returns cloudinary v2
     */
    get V2(): typeof cloudinary.v2 {
        return cloudinary.v2;
    }

    /**
     * Waits until the asset is uploaded and the display name is the expected one.
     */
    public async waitUntilAssetIsUploaded(publicId: string) {
        await browser.waitUntil(async () => {
            const byPublicId = await this.V2.api.resource(publicId);
            return byPublicId.public_id === publicId;
        }, { timeout: 15000, timeoutMsg: 'Asset not uploaded in time' });
    }
}
