Bedienpost
=============

Overview
---------
This is the source-code for the 'bedienpost' application for the Compass platform. Hosted on www.bedienpost.nl.

Requirements
---------

* node.js npm packet manager (http://nodejs.org)

Run the following from the project directory :

*npm install*


Build
---------

To build the project, run the following from the project directory :

- *grunt*

This generates a dist/public_html folder, with all required files and minified & concatenated *.js* and *.css*.

Deployment
---------

* The *dist/public_html* folder can be copied to the folder from which http:// urls are served on the hosting platform. Usually *public_html*.
