export interface PackageDirectory {
    path: string
    default?: boolean
    package: string
    versionName?: string
    versionDescription?: string
    versionNumber: string
    description?: string
    definitionFile?: string
    dependencies?: PackageDependency[]
    ancestorId?: string
    ancestorVersion?: string
    releaseNotesUrl?: string
    postInstallUrl?: string
    includeProfileUserLicenses?: boolean
    aliasfy?: boolean | {
        mergeMode: boolean
    }
    alwaysDeploy?: boolean
    assignPermSetsPreDeployment?: string[]
    assignPermSetsPostDeployment?: string[]
    buildCollection?: string[]
    destructiveChangePath?: string
    isOptimizedDeployment?: boolean
    ignoreOnStage?: Array<'prepare'
        | 'build'
        | 'deploy'
        | 'validate'
        | 'release'
        | 'quickbuild'>
    postDeploymentScript?: string
    preDeploymentScript?: string
    reconcileProfiles?: boolean
    type?: 'diff' | 'data'
    skipCoverageValidation?: boolean
    tags?: string[]
    testSynchronous?: boolean
    skipDeployOnOrgs?: string[]
    skipInstallOnOrgs?: string[]
    skipTesting?: boolean
    checkpointForPrepare?: boolean
    enableFHT?: boolean
    enableFT?: boolean
    enableFlowActivation?: boolean
    enablePicklist?: boolean
    branch?: string
}

export type PackageDependency = {
    package: string
    versionNumber?: string
    branch?: string
}
