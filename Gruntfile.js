module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        auto_install: { local: {}},

        copy: {
            dist: {
                    files: [
                        {src: 'index.html', dest: 'dist/public_html/index.html'},
                        {src: 'img/logo.png', dest: 'dist/public_html/img/logo.png'},
            {cwd: 'lang/', src: '**/*', dest: 'dist/public_html/lang', expand: true },
			{cwd: 'fonts/', src: '**/*', dest: 'dist/public_html/fonts', expand: true },
                        {src: 'index-https.html', dest: 'dist/private_html/index.html'},
                        {src: 'retrievePhoneAuth.php', dest: 'dist/private_html/retrievePhoneAuth.php'},
                        {src: 'retrieveContacts.php', dest: 'dist/private_html/retrieveContacts.php'},
                        {src: 'remoteStorage.php', dest: 'dist/private_html/remoteStorage.php'},
                        {src: 'generic.php', dest: 'dist/private_html/generic.php'},
                        {src: 'db_auth.php', dest: 'dist/private_html/db_auth.php'},
                        {src: 'beheer/index.html', dest: 'dist/private_html/beheer/index.html'},
                        {src: 'beheer/setPhoneAuth.php', dest: 'dist/private_html/beheer/setPhoneAuth.php'},
                        {src: 'beheer/index.html', dest: 'dist/private_html/beheer/index.html'},
                        {src: 'vcardImport/index.php', dest: 'dist/private_html/vcardImport/index.php'},
                        {src: 'vcardImport/.htaccess', dest: 'dist/private_html/vcardImport/.htaccess'},
                        {src: 'vcardImport/vcardImport.php', dest: 'dist/private_html/vcardImport/vcardImport.php'},
                        {src: 'vcardImport/lib/vCard.php', dest: 'dist/private_html/vcardImport/lib/vCard.php'},
                        {src: 'admin/index.php', dest: 'dist/private_html/admin/index.php'},
                        {src: 'admin/.htaccess', dest: 'dist/private_html/admin/.htaccess'},
                        {src: 'admin/StoreSnomConnection.php', dest: 'dist/private_html/admin/StoreSnomConnection.php'},
                        {src: 'admin/lib/vCard.php', dest: 'dist/private_html/admin/lib/vCard.php'},
                        {src: 'admin/vcardimport.php', dest: 'dist/private_html/admin/vcardimport.php'},
                        {src: 'admin/settings.php', dest: 'dist/private_html/admin/settings.php'}
                    ]
            }
        },

        useminPrepare: {
            options: {
                dest: 'dist/public_html'
            },
            html: 'index.html'
        },

        usemin: {
            html: ['dist/public_html/index.html']
        },

        cacheBust: {
            taskName: {
                options: {
                    baseDir: './dist/public_html/',
                    assets: ['js/app.js', 'js/libs.js', 'css/style.css']

                },
                src: ['dist/public_html/index.html']
            }
        },

    });

    grunt.loadNpmTasks('grunt-contrib-uglify-es');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-usemin');
    grunt.loadNpmTasks('grunt-auto-install');
    grunt.loadNpmTasks('grunt-cache-bust');


    grunt.registerTask('default', ['auto_install','useminPrepare', 'copy', 'concat', 'uglify', 'cssmin', 'usemin', 'cacheBust']);


}
