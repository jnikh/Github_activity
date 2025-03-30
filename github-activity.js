#!/usr/bin/env node

const https = require('https');
const readline = require('readline');

// Configuration
const REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_EVENTS = 20; // Maximum events to display

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  event: '\x1b[36m', // Cyan
  repo: '\x1b[34m', // Blue
  number: '\x1b[33m', // Yellow
  action: '\x1b[32m', // Green
  error: '\x1b[31m' // Red
};

async function main() {
  try {
    const username = process.argv[2];
    
    if (!username) {
      console.error('Usage: github-activity <username> [--refresh]');
      process.exit(1);
    }

    const refreshMode = process.argv.includes('--refresh');
    
    console.log(`\n${colors.action}Tracking GitHub activity for ${username}${colors.reset}\n`);
    
    // Initial fetch
    await fetchAndDisplayEvents(username);
    
    // Refresh mode
    if (refreshMode) {
      setInterval(async () => {
        await fetchAndDisplayEvents(username);
      }, REFRESH_INTERVAL);
    }
  } catch (error) {
    console.error(`${colors.error}Error:${colors.reset} ${error.message}`);
    process.exit(1);
  }
}

async function fetchAndDisplayEvents(username) {
  try {
    const events = await fetchGitHubEvents(username);
    clearConsole();
    displayActivity(events);
    console.log(`\n${colors.action}Last updated: ${new Date().toLocaleTimeString()}${colors.reset}`);
    console.log(`${colors.action}Press Ctrl+C to exit${colors.reset}`);
  } catch (error) {
    console.error(`${colors.error}Error fetching events:${colors.reset} ${error.message}`);
  }
}

function fetchGitHubEvents(username) {
  return new Promise((resolve, reject) => {
    const token = process.env.GITHUB_TOKEN || '';
    const options = {
      hostname: 'api.github.com',
      path: `/users/${encodeURIComponent(username)}/events?per_page=${MAX_EVENTS}`,
      headers: {
        'User-Agent': 'Node.js GitHub Activity CLI',
        'Accept': 'application/vnd.github+json',
        'Authorization': token ? `Bearer ${token}` : '',
        'Cache-Control': 'no-cache'
      },
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

    req.end();
  });
}

function displayActivity(events) {
  if (!events || events.length === 0) {
    console.log(`${colors.event}No recent activity found.${colors.reset}`);
    return;
  }

  console.log(`${colors.action}Recent activity:${colors.reset}\n`);

  // Track seen events to avoid duplicates
  const seenEvents = new Set();
  let displayedCount = 0;

  events.forEach(event => {
    try {
      // Skip duplicates
      if (seenEvents.has(event.id)) return;
      seenEvents.add(event.id);
      
      // Limit displayed events
      if (displayedCount++ >= MAX_EVENTS) return;

      const { type, repo, payload, created_at } = event;
      const date = new Date(created_at).toLocaleTimeString();
      
      // Handle repo name
      let repoName = 'unknown repository';
      if (repo) {
        repoName = typeof repo === 'object' ? repo.name : repo;
      }

      // Format output
      const repoDisplay = `${colors.repo}${repoName}${colors.reset}`;
      const timeDisplay = `[${colors.number}${date}${colors.reset}]`;
      const eventDisplay = `${colors.event}${type}${colors.reset}`;

      switch (type) {
        case 'PushEvent':
          const commits = payload.commits.length;
          const commitWord = commits > 1 ? 'commits' : 'commit';
          console.log(`${timeDisplay} - Pushed ${colors.number}${commits}${colors.reset} ${commitWord} to ${repoDisplay}`);
          break;
          
        case 'PullRequestEvent':
          const prAction = payload.action;
          const prNum = payload.number;
          console.log(`${timeDisplay} - ${colors.action}${prAction}${colors.reset} pull request ${colors.number}#${prNum}${colors.reset} in ${repoDisplay}`);
          break;
          
        case 'IssuesEvent':
          const issueAction = payload.action;
          const issueNum = payload.issue.number;
          console.log(`${timeDisplay} - ${colors.action}${issueAction}${colors.reset} issue ${colors.number}#${issueNum}${colors.reset} in ${repoDisplay}`);
          break;
          
        case 'CreateEvent':
          const refType = payload.ref_type;
          const ref = payload.ref ? ` ${payload.ref}` : '';
          console.log(`${timeDisplay} - Created ${colors.action}${refType}${ref}${colors.reset} in ${repoDisplay}`);
          break;
          
        case 'ForkEvent':
          const forkedTo = payload.forkee?.full_name || 'unknown repository';
          console.log(`${timeDisplay} - Forked ${repoDisplay} to ${colors.repo}${forkedTo}${colors.reset}`);
          break;
          
        default:
          console.log(`${timeDisplay} - Performed ${eventDisplay} on ${repoDisplay}`);
          break;
      }
    } catch (error) {
      console.error(`${colors.error}Error parsing event:${colors.reset} ${error.message}`);
    }
  });
}

function clearConsole() {
  if (process.stdout.isTTY) {
    // For terminal environments
    const blank = '\n'.repeat(process.stdout.rows);
    console.log(blank);
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
  }
}

main();