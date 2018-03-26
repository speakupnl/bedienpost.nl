<html>
    <?php

    require_once("../generic.php");



    // split the user/pass parts
    list($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']) = explode(':', base64_decode(substr($_SERVER['HTTP_AUTHORIZATION'], 6)));

    if ($_SERVER['PHP_AUTH_USER'] == null) {
        header('WWW-Authenticate: Basic realm="VCard import"');
        header('HTTP/1.0 401 Unauthorized');
        echo 'Please authenticate';
        exit;
    } else {

        if (checkUser($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']) != false) {
            ?>
            <p>Hello <?php echo $_SERVER['PHP_AUTH_USER'] ?></p>
            <p><form enctype="multipart/form-data" action="vcardimport.php" method="POST"> Please choose the vcard-file to upload:</p>
                <input name="uploadedfile" type="file" /><br /> <input type="submit" value="Upload" />
            </form>
            <?php
        } else {
            header('WWW-Authenticate: Basic realm="VCard import"');
            header('HTTP/1.0 401 Unauthorized');
            echo 'Incorrect password';
            exit;
        }
    }

    ?>
</html>