const core = require('@actions/core');
const github = require('@actions/github');
const labels = JSON.parse(core.getInput('labels'));
const checkStatus = core.getInput('checkStatus');
const token = core.getInput('token');
const repoOwner = github.context.repo.owner;
const repo = github.context.repo.repo;
const runId = github.context.runId;

const QUERY = `query($owner: String!, $repo: String!, $pull_number: Int!) {
  repository(owner: $owner, name:$repo) {
    pullRequest(number:$pull_number) {
      commits(last: 1) {
        nodes {
          commit {
            checkSuites(first: 100) {
              nodes {
                checkRuns(first: 100) {
                  nodes {
                    name
                    conclusion
                    permalink
                  }
                }
              }
            }
            status {
              state
              contexts {
                state
                targetUrl
                description
                context
              }
            }
          }
        }
      }
    }
  }
}`


async function pullRequests(octokit, repoOwner, repo) {
    const {data: pullRequests} = await octokit.request('GET /repos/:owner/:repo/pulls', {
        owner: repoOwner,
        repo: repo
    })

    return pullRequests;
}

async function filterStatus(octokit, owner, repo, pull_number) {
    if (checkStatus !== 'true') {
        return true;
    }

    const result = await octokit.graphql(QUERY, {owner, repo, pull_number});
    const [{commit: lastCommit}] = result.repository.pullRequest.commits.nodes;

    const allChecksSuccess = [].concat(
        ...lastCommit.checkSuites.nodes.map(node => node.checkRuns.nodes)
    ).every(checkRun => checkRun.conclusion === "SUCCESS")

    // lastCommit status is null if not using external CI
    if (lastCommit.status === null) {
        return allChecksSuccess
    }

    const allStatusesSuccess = lastCommit.status.contexts.every(status => status.state === "SUCCESS");

    return allStatusesSuccess || allChecksSuccess
}

function filterLabel(labels, target) {
    const labelname = labels.map(function (label) {
        return label.name;
    });
    const filterdLabels = labelname.filter(function (label) {
        return target.indexOf(label) !== -1;
    });

    return filterdLabels.length === target.length;
}

function setOutput(pulls) {
    let output = '';
    for (const p of pulls) {
        output = output + p.title + "\\n" + p.html_url + "\\n---\\n";
    }

    output = output.slice(0, -7); // Remove last splitter
    core.setOutput('pulls', output);
    core.setOutput('count', pulls.length);
}

async function filterPulls(octokit, pulls) {
    const filteredPulls = [];

    for (const p of pulls) {
        if (!filterLabel(p.labels, labels)) {
            console.debug('Pull request does not have required lables: ' + p.title)
            continue;
        }

        if (!await filterStatus(octokit, repoOwner, repo, p.number)) {
            console.debug('Pull request is not in a valid state: ' + p.title)
            continue;
        }

        filteredPulls.push(p);
    }

    return filteredPulls;
}

async function main() {
    const octokit = github.getOctokit(token);

    let pulls = await pullRequests(octokit, repoOwner, repo);
    pulls = await filterPulls(octokit, pulls);
    setOutput(pulls);
}

main().then(r => console.log('Check completed.'));

