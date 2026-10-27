'use strict';
const {main}=require('./i18n.cjs');
function updatePresentation(){
  return {language:main.language,direction:main.direction,title:main.t('Updating Hydra Nexus'),wait:main.t('Hydra will reopen automatically after the update.'),minimize:main.t('Minimize'),cancel:main.t('Cancel'),close:main.t('Close'),success:main.t('Update complete'),ready:main.t('Hydra is ready.'),attention:main.t('Update needs attention.'),unconfirmed:main.t('The update was installed, but Hydra has not confirmed startup. Open Hydra when ready.'),restored:main.t('Previous installation restored.'),cancelled:main.t('Cancelled before installation.'),steps:[main.t('Preparing the update'),main.t('Saving your work'),main.t('Creating a verified recovery copy'),main.t('Installing the update'),main.t('Verifying the installation'),main.t('Reopening Hydra')]};
}
module.exports={updatePresentation};
