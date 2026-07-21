
rm -rf dist
npm run build
aws s3 sync dist/public/ s3://navjivan-frontend --delete
aws cloudfront create-invalidation --distribution-id E3RAKPQLOZ0T4H --paths "/*"
