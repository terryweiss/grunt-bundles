# grunt-bundles [![Built with Grunt](https://cdn.gruntjs.com/builtwith.png)](http://gruntjs.com/) #

> Finer control over the browserify and neat aliasing of multiple dependent bundles

## Why? ##

Browserify is an amazing tool and it gives you all the features you need to manage a large project which may be broken up 
into several sharable components. In fact, there are a [bunch](http://benclinkinbeard.com/posts/external-bundles-for-faster-browserify-builds/)
of [great](http://stackoverflow.com/questions/23748841/create-separate-javascript-bundles-with-a-shared-common-library-using-browserify)
[articles](http://stackoverflow.com/questions/21805308/sharing-common-code-across-pages-with-browserify) and 
[tutorials](http://aeflash.com/2014-03/a-year-with-browserify.html) that show you how to do it. When you have a few files
it's pretty cool, but when you have a large library of modules managing the `external` definitions is a real hassle and
not very scalable. Consider this:


	/authorization
	/ui-lib
		/controls
		/transitions
		/validation
		/widgets	
    /communications
    /app
        /home
        /contacts
        /news
        /reporting
        

Now, let's assume that each of those folders contain at least 4 files each. Now, your goal is to create a re-usable 
library for `authorization`, another for `ui-lib` and one more for `communications`. `app` is your application and each of 
its child folders will also be compiled into seperate bundles which may take advantage of any of the top level libraries. 
Let's say that `contacts` and `news` take advantage of `authorization` and `ui-lib`. Recall that each library contains 
multiple modules. 

So, from contacts, we'd have to report each module from `authorization` and `ui-lib` as externals and with each 
new modules, we'd have to update the externals. But in the event that have taken advantage of the alias capabilities of the modules, then you have a real problem, because externals
don't know what the aliases were when you defined it.
 
Those are the problems that `grunt-bundles` are intended to solve. 

## tl;dr
 
	bundles  : {
	    authorization : {       
	        dest    : "bundles/authorization.js",
	        publish : {                             // publish modules can be called by other modules using `require`                           
	            src : ["src/authorization/**/*.js"]
	        } ,
	        aliases : [                             // aliases make the modules available under a different path 
	            {                                   // in this case `src/authorization/foo` modules will be published 
	                cwd  : "src/authorization",     // as just `authorization/foo`
	                src  : ["**/*.js"],
	                dest : "authorization"          // when using `cwd`, `dest` usually means output, but in this case
	                                                // it is the name that will be used for the alias
	            }
	        ]
	    },
	    "ui-lib" : {
	        depends : ["authorization"],            // by declaring `authorization` as a dependency, it means that  
	        dest    : "bundles/ui-lib.js",          // any references to `src/authorization` will be replaced by 
	        publish : {                             // authorization's alias. 
	            src : ["src/ui-lib/**/*.js"]
	        },
	        aliases : [
	            {
	                cwd  : "src/ui-lib",
	                src  : ["**/*.js"],
	                dest : "ui"                     // `ui` will be how we call modules in this bundle
	            }
	        ]
	    },
	    app  : {
	        depends : ["authorization", "ui-lib"],
	        dest    : "bundles/app.js",
	        exec    : {                             // `exec` means that whatever files are here will be executed when the 
	            src : ["src/app/main.js"]           // bundle loads
	        }
	    }
	}



# Getting Started
This plugin requires Grunt `~0.4.5`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-bundles --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-bundles');
```

# The "bundles" task

In your project's Gruntfile, add a section named `bundles` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  bundles: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific file lists and/or options go here.
    },
  },
});
```

## task definition

### depends
Type: `[string]`

An array of subtasks to be used to resolve external alias names. 

### aliases
	 aliases : [
	    {
	        cwd  : "fixtures",
	        src  : ["lib2*.js"],
	        dest : "lib2"
	    }
	]
	
Type: `[object]`

#### aliases.src
Type: `[string]`

An array of paths to be aliased

#### aliases.cwd
Type: `string`

A directory name that will be used to locate the files and used to identify the alias
 	
#### aliases.dest
Type: `string`
 	
The name that will be used when the module is published. It is used to replace the value of `aliases.cwd`  	

### exec
	exec:{
		src:["foo/bar.js", "pond/**.*.js"]
	}
	
Type: `object`

The modules that you want to execute when the bundle is loaded

#### exec.src
Type: `[string]`

An array of paths to be executed when loaded

### externals
	externals:{
		src:["foo/bar.js", "williams/**.*.js"]
	}
	
Type: `object`

Generally `grunt-bundles` should work out the externals stuff for you, 
but you may want to declare some stuff on your own

#### externals.src
Type: `[string]`

An array of paths to be marked external


### ignore
	ignore:{
		src:["foo/bar.js", "vastra/**.*.js"]
	}
	
Type: `object`

These modules will be ignored by browserify

#### ignore.src
Type: `[string]`

An array of paths to be ignored

### modules
	ignore:{
		src:["foo/bar.js", "soufle/**.*.js"]
	}
	
Type: `object`

Generally you depend on browserify to work out what belongs in your bundles
by traversing the require tree. But there are times when you just want to
tell it to use this file right here. And so we have `modules`

#### modules.src
Type: `[string]`

An array of paths to be included

### noParse
	publish:{
		src:["foo/bar.js", "tardis/**.*.js"]
	}
	
Type: `object`

These modules will not be parsed by browserify at all 

#### noParse.src
Type: `[string]`

An array of paths that will not be parsed

### publish
	publish:{
		src:["foo/bar.js", "strax/**.*.js"]
	}
	
Type: `object`

These modules will be made available to other modules via `require`

#### publish.src
Type: `[string]`

An array of paths to be published

## Options

These options are all passed through to browserify:
	
	// When true, aliases are are resolved against dependencies and formatted so that they can compile
	resolveAliases      : true, 
	// When insertGlobals is true, always insert process, global, __filename, and __dirname without 
	// analyzing the AST for faster builds but larger output bundles. Default false.
	insertGlobals       : false,
	// When detectGlobals is true, scan all files for process, global, __filename, 
	// and __dirname, defining as necessary. With this option npm modules are more likely to work but 
	// bundling takes longer. Default true.
	detectGlobals       : true, 
	// When debug is true, add a source map inline to the end of the bundle. This makes debugging easier 
	// because you can see all the original files if you are in a modern enough browser.
	debug               : false,
	// When standalone is a non-empty string, a standalone module is created with that name and a umd 
	// wrapper. You can use namespaces in the standalone global export using a . in the string name as a separator. 
	// For example: 'A.B.C'
	standalone          : null, 
	// Creates global variables in the bundle
	insertGlobalVars    : null, 
	// When true all `depends` entries are automatically made external
	autoExternals       : true, 
	// When true creates an envelope listing all kinds of useless information to the log,
	envelope            : false,
	// is an array of optional extra extensions for the module lookup machinery to use when the 
	// extension has not been specified. By default browserify considers only .js and .json files in such cases.
	extensions          : null,
	// is the directory that browserify starts bundling from for filenames that start with ..,
	basedir             : ".", 
	//sets the algorithm used to parse out the common paths. Use false to turn this off, 
	// otherwise it uses the commondir module.
	commondir           : null, 
	// disables converting module ids into numerical indexes. This is useful for preserving the 
	// original paths that a bundle was generated with.
	fullPaths           : false,
	// sets the list of builtins to use, which by default is set in lib/builtins.js in this distribution.
	builtins            : null, 
	// boolean option to set if external modules should be bundled. Defaults to true.
	bundleExternal      : true, 
	// sets the browser-pack implementation to use.
	pack                : null,
	// defaults to 'require' in expose mode but you can use another name.
	externalRequireName : null 

# Contributing
Yes! Contribute! Test! Share your ideas! Report Bugs!

# Release History

* 0.2.0 Initial release

# License

grunt-bundles Copyright (c) 2014 Terry Weiss. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
