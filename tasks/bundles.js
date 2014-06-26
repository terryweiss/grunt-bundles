'use strict';
/**
 * grunt-bundles
 * https://github.com/terryweiss/grunt-bundles
 *
 * Copyright (c) 2014 Terry Weiss
 * Licensed under the MIT license.
 */


var sys = require( "lodash" );
var path = require( "path" );
var browsCompiler = require( 'browserify' );
var through = require( 'through' );
var async = require( "async" );

module.exports = function ( grunt ) {

	grunt.registerMultiTask( 'bundles', 'Finer control over the browserify and neat aliasing of multiple dependent bundles', function () {

		var complete = this.async();
		var task = this;

		/** Options for the process */
		var options = this.options( {
			depends             : [], // A list of bundles this task depends on, string array of task names to analyze
			resolveAliases      : true, // When true, aliases are are resolved against dependencies and formatted so that they can compile
			insertGlobals       : false, // When opts.insertGlobals is true, always insert process, global, __filename, and __dirname without analyzing the AST for faster builds but larger output bundles. Default false.
			detectGlobals       : true, // When opts.detectGlobals is true, scan all files for process, global, __filename, and __dirname, defining as necessary. With this option npm modules are more likely to work but bundling takes longer. Default true.
			debug               : false, // When opts.debug is true, add a source map inline to the end of the bundle. This makes debugging easier because you can see all the original files if you are in a modern enough browser.
			standalone          : null, // When opts.standalone is a non-empty string, a standalone module is created with that name and a umd wrapper. You can use namespaces in the standalone global export using a . in the string name as a separator. For example: 'A.B.C'
			insertGlobalVars    : null, // Creates global variables in the bundle
			autoExternals       : true, // When true all `depends` entries are automatically made external
			envelope            : false, // When true creates an envelope listing all kinds of useless information to the log,
			extensions          : null, // is an array of optional extra extensions for the module lookup machinery to use when the extension has not been specified. By default browserify considers only .js and .json files in such cases.
			basedir             : ".", // is the directory that browserify starts bundling from for filenames that start with ..,
			commondir           : null, //sets the algorithm used to parse out the common paths. Use false to turn this off, otherwise it uses the commondir module.
			fullPaths           : false, // disables converting module ids into numerical indexes. This is useful for preserving the original paths that a bundle was generated with.
			builtins            : null, // sets the list of builtins to use, which by default is set in lib/builtins.js in this distribution.
			bundleExternal      : true, // boolean option to set if external modules should be bundled. Defaults to true.
			pack                : null, // sets the browser-pack implementation to use.
			externalRequireName : null // defaults to 'require' in expose mode but you can use another name.
		} );

		/** find another task's entries */
		var getTaskSources = function ( taskName ) {
			var task = grunt.config.get( "bundles" )[taskName];
			var retVal = [];
			if ( task ) {
				var sources = task.modules;
				if ( !sys.isEmpty( sources ) && !sys.isEmpty( sources.src ) ) {
					grunt.log.writeln( "Adding sources for " + taskName );
					retVal = sys.map( grunt.file.expand( sources, sources.src ), function ( item ) {
						return resolvePath( item );
					} );
				}
			}
			return retVal;
		};

		/** Resolve modules paths */
		var resolvePath = function ( file ) {
			var resolved;
			var expanded = grunt.file.expand( file )[0];
			console.info(file);
			if ( !expanded ) {
				resolved = require.resolve( file );
			} else {
				resolved = path.resolve( expanded );
			}

			return resolved;
		};

		/** process the various entries, make sense of them and return them as a single hash table */
		var packageFileEntries = function () {
			/** A stateful object to hold items till they are added to the compiler */
			var pkg = {
				exec          : [],
				aliases       : {},
				dependAliases : [],
				ignore        : [],
				publish       : [],
				externals     : [],
				modules       : [],
				noParse       : []
			};

			// process modules to ignore
			var ignore = task.data.ignore;
			if ( !sys.isEmpty( ignore ) && !sys.isEmpty( ignore.src ) ) {
				grunt.verbose.writeln( "Adding ignores" );

				pkg.ignore = sys.map( grunt.file.expand( ignore, ignore.src ), function ( item ) {
					return resolvePath( item );
				} );
			}

			// process modules that won't be parsed
			var noParse = task.data.noParse;
			if ( !sys.isEmpty( noParse ) && !sys.isEmpty( noParse.src ) ) {
				grunt.verbose.writeln( "Adding ignores" );

				pkg.noParse = sys.map( grunt.file.expand( noParse, noParse.src ), function ( item ) {
					return resolvePath( item );
				} );
			}

			// process executable modules
			var exec = task.data.exec;
			if ( !sys.isEmpty( exec ) && !sys.isEmpty( exec.src ) ) {
				grunt.verbose.writeln( "Adding executable modules" );

				pkg.exec = sys.map( grunt.file.expand( exec, exec.src ), function ( item ) {
					return resolvePath( item );
				} );
			}

			// process module entries
			var modules = task.data.modules;
			if ( !sys.isEmpty( modules ) && !sys.isEmpty( modules.src ) ) {
				grunt.verbose.writeln( "Adding modules" );

				pkg.modules = sys.map( grunt.file.expand( modules, modules.src ), function ( item ) {
					return resolvePath( item );
				} );
			}

			// process modules to be published
			var publish = task.data.publish;
			if ( !sys.isEmpty( publish ) && !sys.isEmpty( publish.src ) ) {
				grunt.verbose.writeln( "Adding published modules" );

				pkg.publish = sys.map( grunt.file.expand( publish, publish.src ), function ( item ) {
					return resolvePath( item );
				} );
			}

			// process externals entries
			var externals = task.data.externals;
			if ( !sys.isEmpty( externals ) && !sys.isEmpty( externals.src ) ) {
				grunt.log.writeln( "Adding external modules" );

				pkg.externals = sys.map( grunt.file.expand( externals, externals.src ), function ( item ) {
					return resolvePath( item );
				} );
			}

			// get all task aliases
			sys.extend( pkg.aliases, getTaskAliases( task.target, options ) );
			if ( !sys.isEmpty( task.data.depends ) ) {
				sys.each( task.data.depends, function ( depends ) {
					var dependents = getTaskAliases( depends, options );

					sys.each( dependents, function ( val, key ) {
						pkg.dependAliases.push( key );
					} );
				} );
			}

			// get dependencies definitions and add them to this as external
			if ( options.autoExternals && !sys.isEmpty( task.data.depends ) ) {
				sys.each( task.data.depends, function ( depends ) {
					pkg.externals = pkg.externals.concat( getTaskSources( depends ) );
				} );
			}

			return pkg;
		};

		/** find alias definitions and map them to file names **/
		var getTaskAliases = function ( taskName ) {
			var task = grunt.config.get( "bundles" )[taskName];

			var retVal = {};
			if ( task && task.aliases ) {
				var aliases = task.aliases;
				if ( !sys.isEmpty( aliases ) ) {
					grunt.verbose.writeln( "Adding aliases for " + taskName );
					if ( sys.isArray( aliases ) ) {
						sys.each( aliases, function ( map ) {
							map = map || {};

							if ( !sys.isString( map.dest ) ) {map.dest = map.cwd;}
							if ( !sys.isString( map.dest ) ) {return grunt.util.error( "dest or cwd is required" );}

							map.cwd = map.cwd || "";
							map.expand = map.expand !== false;
							var files = grunt.file.expand( map, map.src );
							sys.each( files, function ( item ) {
								var thisPath;
								if ( sys.isEmpty( map.dest ) ) {
									thisPath = item;
								} else {
									thisPath = path.join( map.dest, item );
								}

								var thisAlias = thisPath.replace( /\.[^/.]+$/, "" ).replace( /\\/g, "/" );
								retVal[thisAlias] = resolvePath(  path.join( map.cwd, item ) );
							} );
						} );
					} else {
						sys.each( aliases, function ( item, key ) {
							retVal[key] = resolvePath( item );
						} );

					}
				}
			}
			return retVal;
		};

		/** Create the browserify instance and prep it */
		var createCompiler = function ( pkg ) {
			grunt.verbose.writeln( "Populating compiler" );
			var copts = {
				noParse             : pkg.noParse,
				entries             : pkg.modules,
				externalRequireName : options.externalRequireName,
				pack                : options.pack,
				bundleExternal      : options.bundleExternal,
//				builtins            : options.builtins,
				fullPaths           : options.fullPaths,
				commondir           : options.commondir,
				basedir             : options.basedir,
				extensions          : options.extensions
			}

			if ( !sys.isEmpty( options.builtins ) ) {
				copts.builtins = options.builtins;
			}

			var compiler = browsCompiler( copts );
			sys.each( pkg.exec, function ( item ) {
				compiler.add( item );
			} );

			sys.each( pkg.aliases, function ( item, name ) {
				compiler.require( item, {expose : name} );
			} );

			sys.each( pkg.publish, function ( item ) {
				compiler.require( item );
			} );

			sys.each( pkg.externals, function ( item ) {
				compiler.external( item );
			} );

			sys.each( pkg.ignore, function ( item ) {
				compiler.ignore( item );
			} );

			return compiler;
		};

		/** transform dependencies while browserify runs */
		var transformDependencies = function ( pkg, compiler ) {
			if ( !sys.isEmpty( task.data.depends ) && options.resolveAliases && !sys.isEmpty( pkg.dependAliases ) ) {

				compiler.transform( function ( file ) {
					grunt.verbose.writeln( "Transforming " + file );
					function write( buf ) {
						data += buf;
					}

					var data = '';

					return through( write, function () {
						var __aliases = [];
						sys.each( pkg.dependAliases, function ( al ) {
							if ( data.indexOf( "'" + al + "'" ) !== -1 || data.indexOf( '"' + al + '"' ) !== -1 ) {
								__aliases.push( "'" + al + "' : '" + al + "'" );

								data = data.replace( new RegExp( "'" + al + "'", "g" ), "__aliases['" + al + "']" );
								data = data.replace( new RegExp( '"' + al + '"', "g" ), "__aliases['" + al + "']" );
							}
						} );
						if ( !sys.isEmpty( __aliases ) ) {
							var aliasDefinition = "var __aliases = {" + __aliases.join( ",\n" ) + "};\n";

							data = aliasDefinition + data;

						}
						this.queue( data );
						this.queue( null );
					} );

				} );
			}
		};

		var pkg = packageFileEntries();
		var compiler = createCompiler( pkg );
		transformDependencies( pkg, compiler );

		var opts = {
			insertGlobals    : options.insertGlobals,
			detectGlobals    : options.detectGlobals,
			debug            : options.debug,
			standalone       : options.standalone,
			insertGlobalVars : options.insertGlobalVars
		};

		grunt.verbose.writeln( "Compiling with:\n" +
				JSON.stringify( opts, null, 2 ) + "\n" +
				JSON.stringify( pkg, null, 2 ) + "\n"
		);

		async.parallel( [function ( done ) {
			if ( options.envelope ) {
				var d = compiler.deps( { packageFilter : function packageFilter( info ) {
					if ( typeof info.browserify === 'string' && !info.browser ) {
						info.browser = info.browserify;
						delete info.browserify;
					}
					return info;
				} } );
				d.pipe( through( function ( dep ) {
					grunt.verbose.writeln( JSON.stringify( {
						id      : dep.id || dep.exposed,
						deps    : dep.deps,
						exposed : dep.exposed || dep.id,
						entry   : dep.entry
					}, null, 2 ) );

				} ), function () {
					done();
				} );
			} else {
				done();
			}
		}, function ( done ) {
			compiler.bundle( opts, function ( err, data ) {
				if ( err ) { return done( err ); }

				grunt.verbose.writeln( "Writing " + task.data.dest );
				grunt.file.write( path.resolve( task.data.dest ), data );

				grunt.verbose.writeln( "Compiled:\n" +
						JSON.stringify( compiler, null, 2 )
				);
				grunt.verbose.writeln( task.data.dest + " complete" );
				done();
			} );
		}], function ( err ) {
			if ( err ) {
				return grunt.fail.warn( err );
			}
			complete();
		} );

	} );

};






