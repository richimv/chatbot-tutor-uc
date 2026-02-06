export default function handler(req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send('google-site-verification: google9e7db62b59fd1348.html');
}
