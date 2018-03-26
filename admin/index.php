<!DOCTYPE html>
<html>
<head>
    <title>Admin</title>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <link href="../css/style.css" rel="stylesheet" type="text/css"/>

</head>
<body>
<?php

    require_once("../generic.php");

    // split the user/pass parts
    list($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']) = explode(':', base64_decode(substr($_SERVER['HTTP_AUTHORIZATION'], 6)));

    if ($_SERVER['PHP_AUTH_USER'] == null) {
        header('WWW-Authenticate: Basic realm="Admin"');
        header('HTTP/1.0 401 Unauthorized');
        echo 'Please authenticate';
        exit;
    } else {
        if (checkUser($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW']) != false) {
            ?>
                   <p>
                        <h2>Instellingen voor alle gebruikers binnen het bedrijf</h2>
                        <form method="post" action="settings.php">
                              Verberg laatste 5 cijfers van het telefoonnummer: <input name="obfuscateNumber" type="checkbox" checked> <br/><br/>
                              <input type="submit" />
                       </form>
                   </p>

                   <hr>

                   <p>
                   <h2>Verbind een SNOM VoIP telefoon met de bedienpost.</h2>
                   <form method="post" action="StoreSnomConnection.php">
                              Gebruik verbinding met telefoon om doorschakelingen te kunnen doen.<br/>
                              (Werkt vooralsnog alleen op SNOM 300, 320, 710, 720)<br/><br/>
                              Ingeschakeld: <input name="ingeschakeld" type="checkbox" defaultChecked="false"> <br/><br/>

                              <input type="submit" />
                   </form>
                   </p>

                   <hr>

                   <h2>VCard Importeren</h2>
                   <p>
                      <form enctype="multipart/form-data" action="vcardimport.php" method="POST"> Kies de VCard (vcf) file om te uploaden:</p>
                                   <input name="uploadedfile" type="file" /><br /> <input type="submit" value="Upload" />
                               </form>
                   </p>

                   <hr>

                   <h2>CRM integratie</h2>
                   <p>
                     <form method="post action="crm.php" method="POST">
                        Geef de URL op die aangeroepen moet worden met het inkomende telefoonnummer, als de gebruiker op het inkomend gesprek klikt.<br/>
                        De $ variabele geeft aan waar het telefoonnummer in de URL ingevuld moet worden.<br/><br/>
                        URL: <input name="url" style="width:300px" type="text" placeholder="https://mijn-crm.bedrijf.nl/inkomend-nr/$"/><br /><br/>
                        <input type="submit" />
                     </form>
                   </p>

            <?php
        } else {
            header('WWW-Authenticate: Basic realm="Admin"');
            header('HTTP/1.0 401 Unauthorized');
            echo 'Incorrect password';
            exit;
        }
    }

    ?>

</body>
</html>
