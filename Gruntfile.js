/*
 * grunt-bundles
 * https://github.com/terryweiss/grunt-bundles
 *
 * Copyright (c) 2014 Terry Weiss
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function ( grunt ) {

	// Project configuration.
	grunt.initConfig( {
		jshint   : {
			all     : [
				'Gruntfile.js',
				'tasks/*.js',
				'<%= nodeunit.tests %>'
			],
			options : {
				jshintrc : '.jshintrc'
			}
		},

		// Before generating any new files, remove any previously-created files.
		clean    : {
			tests : ['fixtures/out']
		},

		// Configuration to be run (and then tested).
		bundles  : {
			lib1 : {
				options : {
					aliasManifestDest : "fixtures/out/lib1.json"
				},
				depends : ["lib2"],
				dest    : "fixtures/out/lib1.js",
				modules : {
					src : ["fixtures/lib1-1.js", "fixtures/lib1-2.js"]
				},
				aliases : [
					{
						cwd  : "fixtures",
						src  : ["lib1*.js"],
						dest : "lib1"
					}
				]
			},
			lib2 : {
				dest    : "fixtures/out/lib2.js",
				publish : {
					src : ["fixtures/lib2-1.js", "fixtures/lib2-2.js"]
				},
				aliases : [
					{
						cwd  : "fixtures",
						src  : ["lib2*.js"],
						dest : "lib2"
					}
				],
				options : {
					aliasManifestSrc : "fixtures/external.manifest.json"
				}
			},
			app  : {
				depends : ["lib1", "lib2"],
				dest    : "fixtures/out/app.js",
				exec    : {
					src : ["fixtures/app.main.js", "fixtures/app.js"]
				}
			}

		},

		// Unit tests.
		nodeunit : {
			tests : ['test/*_test.js']
		}

	} );

	// Actually load this plugin's task(s).
	grunt.loadTasks( 'tasks' );

	// These plugins provide necessary tasks.
	grunt.loadNpmTasks( 'grunt-contrib-jshint' );
	grunt.loadNpmTasks( 'grunt-contrib-clean' );
	grunt.loadNpmTasks( 'grunt-contrib-nodeunit' );

	// Whenever the "test" task is run, first clean the "tmp" dir, then run this
	// plugin's task(s), then test the result.
	grunt.registerTask( 'test', ['clean', 'bundles', 'nodeunit'] );

	// By default, lint and run all tests.
	grunt.registerTask( 'default', ['clean', 'bundles'] );

};
