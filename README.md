# My YouTube – GitHub Pages

Staattinen YouTube-kanavaselain MIT App Inventorin WebViewerille.

## Käyttöönotto

1. Luo Google Cloud -projekti.
2. Ota käyttöön YouTube Data API v3.
3. Luo API-avain.
4. Aseta avain `config.js`-tiedostoon.
5. Vaihda `channels`-listaan haluamasi YouTube-kanavat.
6. Julkaise kansio GitHub Pagesissa.

## API-avaimen suojaus

Älä käytä tätä avainta muihin Google API -palveluihin. Rajoita API-avain Google Cloudissa YouTube Data API v3:een ja käytä mahdollisuuksien mukaan HTTP-referrer-rajoitusta GitHub Pages -osoitteellesi.

## App Inventor

WebViewerin URL:

`https://KAYTTAJANIMI.github.io/REPOSITORY/`

Jos käytät CustomWebView-laajennusta, varmista että JavaScript, DOM Storage ja fullscreen-video ovat käytössä.

## Huomio

YouTube-videon iframe-soittimen sisäinen käyttöliittymä kuuluu YouTubelle. Tätä projektia voi vapaasti tyylitellä oman sivun osalta, mutta YouTuben iframe:n sisäisiä elementtejä ei voi CSS:llä muokata cross-origin-suojauksen vuoksi.
