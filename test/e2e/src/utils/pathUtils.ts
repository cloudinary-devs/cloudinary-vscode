import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Utility class for working paths.
 */
class PathUtils {
  /**
   * Gets the root path of the project.
   * @returns The root path of the project.
   */
  public getProjectRootPath() {
    return path.resolve(__dirname, '..', '..', '..');
  }

  /**
   * Gets the path to the test assets.
   */
  public getTestAssetsPath() {
    return path.join(__dirname, '..', '..', 'assets');
  }
}

export const pathUtils = new PathUtils();
