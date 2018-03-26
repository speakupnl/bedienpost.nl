var availableLangs = ['en', 'nl'];

console.time('loaded');

i18next
    .use(window.i18nextXHRBackend)
    .init({
        /*debug: true,*/
        preload: availableLangs,
        fallbackLng: 'en',
        keySeparator: false,
        nsSeparator: false,
        backend: {
            "loadPath": "lang/lang-{{lng}}.json"            
       }
    })
    .on('loaded', function(loaded) {
        console.timeEnd('loaded');

        listingViewModel.language( getLanguage() );
    });

/*i18next.on('missingKey', function(lngs, namespace, key, res) {
    console.info("missingKey:" + key);
});*/

function switchLanguage(lang) {
    console.info("lang:" + lang);

    i18next.changeLanguage(lang);

    if (lang) {
        localStorage.setItem("lang", lang);
    }
}

//Logic for determining language
function getLanguage() {
    var langFromUrl = getParameterByName("lang");
    var langFromLocal = localStorage.getItem("lang");

    var lng = 'en';

    if (langFromUrl && availableLangs.indexOf(langFromUrl) >= 0) {
        lng = langFromUrl;
    }
    else if (langFromLocal) {
        lng = langFromLocal;
    }
    else if (availableLangs.indexOf(navigator.language) >= 0) {
        lng = navigator.language;
    }

    if (lng.indexOf('-') !== -1){
        lng = lng.split('-')[0];
    }

    return lng;
}

function getParameterByName(name, url) {
    if (!url) {
        url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
    var results = regex.exec(url);

    if (!results) return null;
    if (!results[2]) return '';
    
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}