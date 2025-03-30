#!/usr/bin/env node

const { execSync } = require("child_process");

const { hostname } = require("os");
const { error } = require("console");

const https = require('https');

async function main() {
  try {
    const username = process.argv[2];
    
    if (!username) {
      console.error('Usage: github-activity <username>');
      process.exit(1);
    }
    
    const events = await fetchGitHubEvents(username);
    displayActivity(events);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

function fetchGitHubEvents(username) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/users/${encodeURIComponent(username)}/events`,
      headers: {
        'User-Agent': 'Node.js GitHub Activity CLI',
        'Accept': 'application/vnd.github+json'
      },
      // Add these for better HTTPS handling
      port: 443,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 404) {
        reject(new Error('User not found'));
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API returned status code ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const events = JSON.parse(data);
          resolve(events);
        } catch (e) {
          reject(new Error('Failed to parse GitHub API response'));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Failed to fetch data from GitHub: ${err.message}`));
    });

    req.end(); // Important: End the request
  });
}
function displayActivity(events) {
    if (!events || events.length === 0) {
      console.log('No recent activity found.');
      return;
    }
  
    console.log('Recent activity:\n');
  
    events.forEach(event => {
      try {
        const { type, repo, payload } = event;
        
        // Handle different repo formats
        let repoName;
        if (typeof repo === 'object') {
          repoName = repo.name;
        } else if (typeof repo === 'string') {
          repoName = repo;
        } else {
          repoName = 'unknown repository';
        }
  
        switch (type) {
          case 'PushEvent':
            const commits = payload.commits.length;
            console.log(`- Pushed ${commits} commit${commits > 1 ? 's' : ''} to ${repoName}`);
            break;
          case 'IssuesEvent':
            const action = payload.action;
            const issueNum = payload.issue.number;
            console.log(`- ${action} issue #${issueNum} in ${repoName}`);
            break;
          case 'PullRequestEvent':
            const prAction = payload.action;
            const prNum = payload.pull_request.number;
            console.log(`- ${prAction} pull request #${prNum} in ${repoName}`);
            break;
          case 'WatchEvent':
            console.log(`- Starred ${repoName}`);
            break;
          case 'ForkEvent':
            const forkedTo = payload.forkee?.full_name || 'unknown repository';
            console.log(`- Forked ${repoName} to ${forkedTo}`);
            break;
          case 'CreateEvent':
            console.log(`- Created ${payload.ref_type} ${payload.ref || ''} in ${repoName}`.trim());
            break;
          case 'DeleteEvent':
            console.log(`- Deleted ${payload.ref_type} ${payload.ref || ''} in ${repoName}`.trim());
            break;
          default:
            // Uncomment to see all event types
            // console.log(`- Performed ${type} on ${repoName}`);
            break;
        }
      } catch (error) {
        console.error('- Could not parse event:', error.message);
      }
    });
  }

main()
