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

This generates a dist/public_html and dist/private_html folder, with all required files and minified & concatenated *.js* and *.css*.

Deployment
---------

* import sql/users.sql in a MySQL DB on the hosting platform to setup the user-table.
* Enter the MySQL DB authentication information in *dist/private_html/retrievePhoneAuth.php* and *dist/private_html/beheer/setPhoneAuth.php*
* The *dist/public_html* folder can be copied to the folder from which http:// urls are served on the hosting platform. Usually *public_html*.
* The *dist/private_html* folder can be copied to the folder from which https:// urls are served on the hosting platform. Usually *private_html*.
* Make sure to protect the *private_html/beheer* directory with a password. (for example with .htaccess / .htpasswd)
