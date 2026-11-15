/**
 * MongoDB Initialization Script
 * Runs on container initial boot when the data volume is empty.
 * Creates an unprivileged application user with least-privilege 'readWrite'
 * access restricted ONLY to the target application database.
 */

/* global db */

const appDatabase = process.env.MONGO_DATABASE || 'hospital_db';
const appUsername = process.env.MONGO_APP_USERNAME || 'hospital_app';
const appPassword = process.env.MONGO_APP_PASSWORD || 'hospital_app_password';

print(`[mongo-init] Configuring application database: ${appDatabase}`);
print(
  `[mongo-init] Creating least-privilege user '${appUsername}' on database '${appDatabase}'...`
);

const targetDb = db.getSiblingDB(appDatabase);

targetDb.createUser({
  user: appUsername,
  pwd: appPassword,
  roles: [
    {
      role: 'readWrite',
      db: appDatabase,
    },
  ],
});

print(
  `[mongo-init] Application user '${appUsername}' created successfully with readWrite permissions.`
);
