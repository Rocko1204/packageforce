import { SfProjectJson } from '@salesforce/core';
import { PackageTree, NamedPackageDirLarge } from './cliTypes';

export function getDeployUrls(
  projectJson: SfProjectJson,
  packagename: string
): PackageTree | undefined {
  const json = projectJson.getContents();

  const packageDirs: NamedPackageDirLarge[] =
    json.packageDirectories as NamedPackageDirLarge[];
  const packageAliases = json.packageAliases || {};
  let packageTree: PackageTree | undefined;
  const currentPackage: NamedPackageDirLarge | undefined = packageDirs.find(
    pck => pck.package === packagename
  );

  if (currentPackage) {
    packageTree = {
      packagename: currentPackage.package,
      path: currentPackage.path,
      managed: false,
      dependency: [],
    };

    if (currentPackage.dependencies) {
      currentPackage.dependencies.forEach(dep => {
        // add only packages !== managed (managed packages start with 04t)
        if (
          packageAliases[dep.package] &&
          !packageAliases[dep.package].startsWith('04t')
        ) {
          const treeDep: PackageTree = {
            packagename: dep.package,
            path: packageDirs.find(pck => pck.package === dep.package)?.path,
          };
          packageTree!.dependency = [
            ...(packageTree!.dependency || []),
            treeDep,
          ];
        }
      });
    }
  }

  return packageTree;
}
