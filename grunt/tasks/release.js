'use strict';

var shell = require('shelljs');
var envl = require('../environment');
var regexVer = /%VERSION%/gmi;
var regexDupLines = /^(.*)(\r?\n\1)+$/gm;

/**
 * When a commit message contains "release v" followed by a version number
 * (major.minor.patch) a tagged release will be issued
 * 
 * @param grunt
 *            the grunt instance
 */
module.exports = function(grunt) {

	var commit = null;

	grunt.registerTask('release',
			'Release bundle using commit message (if present)', function() {
				var options = this.options({
					src : process.cwd(),
					commitMessage : '',
					destBranch : 'gh-pages',
					destDir : 'dist',
					chgLog : 'HISTORY.md',
					authors : 'AUTHORS.md'
				});
				release.call(this, options);
			});

	/**
	 * Checks for release commit message and performs release
	 * 
	 * @param options
	 *            the grunt options
	 */
	function release(options) {
		var chgLogRtn = '';
		var authorsRtn = '';

		// Capture commit message
		commit = envl.getCommit(grunt, options.commitMessage);
		grunt.log.writeln('Commit message: ' + commit.message);
		if (!commit.version) {
			return;
		}

		// TODO : verify commit message release version is less than
		// current version using "git describe --abbrev=0 --tags"
		grunt.log.writeln('Preparing release: ' + commit.version);
		var relMsg = commit.message + '\n' + envl.skipRef('ci');

		// Set identity
		runCmd('git config --global user.email "travis@travis-ci.org"');
		runCmd('git config --global user.name "Travis"');

		// Generate change log for release using all messages since last
		// tag/release
		chgLogRtn = runCmd(
				'git --no-pager log `git describe --tags --abbrev=0`..HEAD --pretty=format:"  * %s"',
				options.destDir + '/' + options.chgLog, false, true, true);

		// Generate list of authors/contributors since last tag/release
		authorsRtn = runCmd('git log --all --format="%aN <%aE>" | sort -u',
				options.destDir + '/' + options.authors, true);

		// Commit local release destination changes
		runCmd('git add --all ' + options.destDir + ' && git commit -m "'
				+ relMsg + '" -- ' + options.destDir);

		// Checkout destination branch
		runCmd('git checkout ' + options.destBranch);
		runCmd({
			shell : 'rm',
			args : [ '-rf', '*' ]
		});
		runCmd('git checkout master -- ' + options.destDir);
		runCmd('git add ' + options.destDir);
		runCmd('git commit -m "' + relMsg + '"');
		runCmd('git push ' + options.destBranch);

		// Cleanup master
		// runCmd('git checkout master');
		// runCmd('git rm -r ' + options.destDir);
		// runCmd('git commit -m "Removing release directory"');
		runCmd('git push master');

		// Tag release
		runCmd('git tag -a ' + commit.version + ' -m "' + chgLogRtn + '"');
		grunt.log.writeln('Released: ' + commit.version + ' from '
				+ options.destDir + ' to ' + options.destBranch);
	}

	/**
	 * Executes a shell command
	 * 
	 * @param cmd
	 *            the command string to execute
	 * @param wpath
	 *            the optional path/file to write the results to
	 * @param nofail
	 *            true to prevent throwing an error when the command fails to
	 *            execute
	 * @param shortlog
	 *            true to log only the length of the output
	 * @param nodups
	 *            true to remove duplicate entry lines from results
	 */
	function runCmd(cmd, wpath, nofail, shortlog, nodups) {
		grunt.log.writeln('>> ' + cmd);
		var rtn = null;
		if (typeof cmd === 'string') {
			rtn = shell.exec(cmd, {
				silent : true
			});
		} else {
			rtn = shell[cmd.shell].apply(shell, cmd.args);
		}
		if (rtn.code !== 0) {
			var e = 'Error "' + rtn.code + '" for commit number ' + commitNum
					+ ' ' + rtn.output;
			if (nofail) {
				grunt.log.error(e);
				return;
			}
			throw grunt.util.error(e);
		}
		var output = rtn.output;
		if (output && nodups) {
			// remove duplicate lines
			output = output.replace(regexDupLines, '$1');
		}
		grunt.log.writeln('<< '
				+ (shortlog === true ? output.length + ' characters' : output));
		if (output && wpath) {
			grunt.file.write(wpath, output);
		}
		return output;
	}
};