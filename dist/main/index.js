require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 301:
/***/ ((module) => {

module.exports = eval("require")("@actions/artifact");


/***/ }),

/***/ 535:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 869:
/***/ ((module) => {

module.exports = eval("require")("@actions/exec");


/***/ }),

/***/ 993:
/***/ ((module) => {

module.exports = eval("require")("@actions/github");


/***/ }),

/***/ 560:
/***/ ((module) => {

module.exports = eval("require")("@actions/glob");


/***/ }),

/***/ 912:
/***/ ((module) => {

module.exports = eval("require")("lcov-total");


/***/ }),

/***/ 37:
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ }),

/***/ 17:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const artifact = __nccwpck_require__(301);
const core = __nccwpck_require__(535);
const exec = __nccwpck_require__(869);
const github = __nccwpck_require__(993);
const glob = __nccwpck_require__(560);
const lcovTotal = __nccwpck_require__(912);
const os = __nccwpck_require__(37);
const path = __nccwpck_require__(17);

const events = ['pull_request', 'pull_request_target'];

async function run() {
  try {
    const tmpPath = path.resolve(os.tmpdir(), github.context.action);
    const coverageFilesPattern = core.getInput('coverage-files');
    const globber = await glob.create(coverageFilesPattern);
    const coverageFiles = await globber.glob();
    const titlePrefix = core.getInput('title-prefix');
    const additionalMessage = core.getInput('additional-message');
    const updateComment = core.getInput('update-comment') === 'true';

    await genhtml(coverageFiles, tmpPath);

    const coverageFile = await mergeCoverages(coverageFiles, tmpPath);
    const totalCoverage = lcovTotal(coverageFile);
    const minimumCoverage = core.getInput('minimum-coverage');
    const gitHubToken = core.getInput('github-token').trim();
    const errorMessage = `The code coverage is too low: ${totalCoverage}. Expected at least ${minimumCoverage}.`;
    const isMinimumCoverageReached = totalCoverage >= minimumCoverage;

    const hasGithubToken = gitHubToken !== '';
    const isPR = events.includes(github.context.eventName);

    if (hasGithubToken && isPR) {
      const octokit = await github.getOctokit(gitHubToken);
      const summary = await summarize(coverageFile);
      const details = await detail(coverageFile, octokit);
      const sha = github.context.payload.pull_request.head.sha;
      const shaShort = sha.substr(0, 7);
      const commentHeaderPrefix = `### ${titlePrefix ? `${titlePrefix} ` : ''} После `;
      let body = `${commentHeaderPrefix} [<code>${shaShort}</code>](${github.context.payload.pull_request.number}/commits/${sha}) выполнен [${github.context.workflow} #${github.context.runNumber}](../actions/runs/${github.context.runId})\nТекущее покрытие: ${totalCoverage}%\n<pre>${summary}\n\nFiles changed coverage rate:${details}</pre>${additionalMessage ? `\n${additionalMessage}` : ''}`;

      if (!isMinimumCoverageReached) {
        body += `\n:no_entry: ${errorMessage}`;
      }

      updateComment ? await upsertComment(body, commentHeaderPrefix, octokit) : await createComment(body, octokit);
    } else if (!hasGithubToken) {
      core.info("github-token received is empty. Skipping writing a comment in the PR.");
      core.info("Note: This could happen even if github-token was provided in workflow file. It could be because your github token does not have permissions for commenting in target repo.")
    } else if (!isPR) {
      core.info("The event is not a pull request. Skipping writing a comment.");
      core.info("The event type is: " + github.context.eventName);
    }

    core.setOutput("total-coverage", totalCoverage);

    if (!isMinimumCoverageReached) {
      throw Error(errorMessage);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function createComment(body, octokit) {
  core.debug("Creating a comment in the PR.")

  await octokit.rest.issues.createComment({
    repo: github.context.repo.repo,
    owner: github.context.repo.owner,
    issue_number: github.context.payload.pull_request.number,
    body,
  });
}

async function upsertComment(body, commentHeaderPrefix, octokit) {
  const issueComments = await octokit.rest.issues.listComments({
    repo: github.context.repo.repo,
    owner: github.context.repo.owner,
    issue_number: github.context.payload.pull_request.number,
  });

  const existingComment = issueComments.data.find(comment =>
    comment.body.includes(commentHeaderPrefix),
  );

  if (existingComment) {
    core.debug(`Updating comment, id: ${existingComment.id}.`);

    await octokit.rest.issues.updateComment({
      repo: github.context.repo.repo,
      owner: github.context.repo.owner,
      comment_id: existingComment.id,
      body,
    });
  } else {
    core.debug(`Comment does not exist, a new comment will be created.`);

    await createComment(body, octokit);
  }
}

async function genhtml(coverageFiles, tmpPath) {
  const workingDirectory = core.getInput('working-directory').trim() || './';
  const artifactName = core.getInput('artifact-name').trim();
  const artifactPath = path.resolve(tmpPath, 'html').trim();
  const args = [...coverageFiles, '--rc', 'lcov_branch_coverage=1'];

  args.push('--output-directory');
  args.push(artifactPath);

  await exec.exec('genhtml', args, { cwd: workingDirectory });

  if (artifactName !== '') {
    const globber = await glob.create(`${artifactPath}/**`);
    const htmlFiles = await globber.glob();

    core.info(`Uploading artifacts.`);

    await artifact
      .create()
      .uploadArtifact(
        artifactName,
        htmlFiles,
        artifactPath,
        { continueOnError: false },
      );
  } else {
    core.info("Skip uploading artifacts");
  }
}

async function mergeCoverages(coverageFiles, tmpPath) {
  // This is broken for some reason:
  //const mergedCoverageFile = path.resolve(tmpPath, 'lcov.info');
  const mergedCoverageFile = tmpPath + '/lcov.info';
  const args = [];

  for (const coverageFile of coverageFiles) {
    args.push('--add-tracefile');
    args.push(coverageFile);
  }

  args.push('--output-file');
  args.push(mergedCoverageFile);

  await exec.exec('lcov', [...args, '--rc', 'lcov_branch_coverage=1']);

  return mergedCoverageFile;
}

async function summarize(coverageFile) {
  let output = '';

  const options = {};
  options.listeners = {
    stdout: (data) => {
      output += data.toString();
    },
    stderr: (data) => {
      output += data.toString();
    }
  };

  await exec.exec('lcov', [
    '--summary',
    coverageFile,
    '--rc',
    'lcov_branch_coverage=1'
  ], options);

  const lines = output
    .trim()
    .split(/\r?\n/)

  lines.shift(); // Removes "Reading tracefile..."

  return lines.join('\n');
}

async function detail(coverageFile, octokit) {
  let output = '';

  const options = {};
  options.listeners = {
    stdout: (data) => {
      output += data.toString();
    },
    stderr: (data) => {
      output += data.toString();
    }
  };

  await exec.exec('lcov', [
    '--list',
    coverageFile,
    '--list-full-path',
    '--rc',
    'lcov_branch_coverage=1',
  ], options);

  let lines = output
    .trim()
    .split(/\r?\n/)

  lines.shift(); // Removes "Reading tracefile..."
  lines.pop(); // Removes "Total..."
  lines.pop(); // Removes "========"

  const listFilesOptions = octokit
    .rest.pulls.listFiles.endpoint.merge({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: github.context.payload.pull_request.number,
    });
  const listFilesResponse = await octokit.paginate(listFilesOptions);
  const changedFiles = listFilesResponse.map(file => file.filename);

  lines = lines.filter((line, index) => {
    if (index <= 2) return true; // Include header

    for (const changedFile of changedFiles) {
      console.log(`${line} === ${changedFile}`);

      if (line.startsWith(changedFile)) return true;
    }

    return false;
  });

  if (lines.length === 3) { // Only the header remains
    return ' n/a';
  }

  return '\n  ' + lines.join('\n  ');
}

run();

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=index.js.map