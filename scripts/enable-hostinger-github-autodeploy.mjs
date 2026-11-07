/**
 * Enable Git auto-deploy for snappygiftz.com (run via Hostinger MCP `execute`).
 *
 * Prerequisites: GitHub connected in hPanel (Advanced → Git → Connect GitHub).
 *
 * Operations (in order):
 * 1. hosting_git_list-installations
 * 2. hosting_git_update-auto-deployment-settings
 * 3. hosting_nodejs_start-build (source_type: git)
 *
 * This file documents the params for the agent; it is not a standalone CLI without the API token.
 */

export const HOSTINGER_GIT_AUTODEPLOY = {
  username: 'u285517860',
  domain: 'snappygiftz.com',
  owner: 'onebridgeinfotech',
  repository: 'Snappy_Giftz',
  branch: 'main',
  nodeBuild: {
    username: 'u285517860',
    domain: 'snappygiftz.com',
    node_version: 22,
    app_type: 'next',
    root_directory: '.',
    output_directory: '.next',
    build_script: 'build',
    package_manager: 'npm',
    source_type: 'git',
    source_options: {
      owner: 'onebridgeinfotech',
      repository: 'Snappy_Giftz',
      branch: 'main',
      // installation_uuid: '<from hosting_git_list-installations>',
    },
  },
};

console.log(JSON.stringify(HOSTINGER_GIT_AUTODEPLOY, null, 2));
