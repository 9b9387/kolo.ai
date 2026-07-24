-- Prisma Migrate needs to create/drop a shadow database during dev.
GRANT ALL PRIVILEGES ON *.* TO 'kolo'@'%';
FLUSH PRIVILEGES;
