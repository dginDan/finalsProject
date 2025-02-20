// Index des routes USAGERS
// Date: 24 aout 2023
// Fournier Allan

//dependencies
const bcrypt = require('bcryptjs');
const express = require('express');
const passport = require('passport');
const mongoose = require('mongoose');
const nodeJSpath = require('path');
const fs = require('fs').promises; 
//les schemas
const Items = require('../models/Items'); 
const Usagers = require('../models/Usagers');
//3x is = role d'un user & ses droits expliquer dans config/auth
const {isAuthentified, isAdmin, isModerateur} = require('../config/auth');


const router = express.Router();

//page qui liste les users
router.get('/listeUsers', isAdmin, (requete, reponse)=>{
    const user = requete.user;
    const userLanguage = requete.session.userLanguage || 'fr';
    Usagers.find({}).sort({date: -1}).exec()
    .then(users => {
    reponse.render(`listeUsagers`, {
        'title': 'Users',
        user : user,
        'liste': users, // liste des users récupérés de la base de données
        'translations': reponse.locals.translations[userLanguage],
        });
    })
});

// page ajout new user
router.get('/ajoutUsager', isAdmin, (requete, reponse)=>{
    const userLanguage = requete.session.userLanguage || 'fr';
    const user = requete.user;
    reponse.render(`ajoutUsager`, {
        'title': 'New User',
        user : user ,
        'translations': reponse.locals.translations[userLanguage],
            });
});

router.post('/userAdd', isAuthentified, (requete, reponse)=>{
    // input to fill - admin/gestion = role, normal by default
    const {nom, email, password, password2, admin, gestion } = requete.body;
    const { originalname, destination, filename, size, path, mimetype } = requete.files[0];
    const mimetypePermis=['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];//type valide
    const maxFileSize = 1024*1024*2;//2mo max / img
    console.log('fichier', originalname, destination, filename, size, path, mimetype);
    console.log('Choix sélectionné', admin, gestion); //ptite verif
    let errors = [];
    const roles = ["normal"];
    if (admin)
        roles.push("admin");
    if (gestion)
        roles.push("gestion");
    console.log("Roles",roles);

    if (size > maxFileSize){
        errors.push({msg:`La taille du fichier est trop grande (max ${maxFileSize})`})
    } else {
        if (!mimetypePermis.includes(mimetype)) {
            errors.push({msg: `Format de fichier non accepté (${mimetypePermis})`});
        }
    }

    if (!nom || !email || !password || !password2){
        errors.push({ msg : 'Remplir toutes les cases du formulaire'});
    }
    if (password !== password2){
        errors.push({ msg: 'Les mots de passe ne correspondent pas'});
    }
    if (password.length < 6){
        errors.push({ msg : 'Le mot de passe doit avoir au moins 6 caractères'});
    }
    if (errors.length > 0){
        //appeler suprimer
        deleteFile(path);
        reponse.render('ajoutUsager',{
            'title': 'Ajout d\'un usager',
            errors : errors,
            nom,
            email,
            password,
            password2,
            admin,
            gestion
        });
    } else {
        //verification si email used
        Usagers.findOne({'email': email})
        .then(user=>{
            if(user){//l'usager est déjà connu dans la bd, reject, stop.
            errors.push({ msg: 'Ce courriel est déjà utilisé'});
            //supprimer fichier
            deleteFile(path);
            reponse.render('ajoutUsager',{
                'title': 'Ajout d\'un usager',
                errors : errors,
                nom,
                email,
                password,
                password2,
                admin,
                gestion
            });
            } else{
                //next step hashing/add profile -> bd \\ if all gut insert return /village
                let _id = new mongoose.Types.ObjectId();
                const newUser = new Usagers({_id, nom, email, password, roles});
                // hachage du mdp
                bcrypt.genSalt(10, (err, salt)=>{
                    if (err) throw err;
                    bcrypt.hash(newUser.password, salt, (err, hash)=>{
                        if (err) throw err;
                        newUser.password = hash;
                        conserverFichier(path, filename);
                        newUser.nomImage = filename;
                        newUser.save()
                        .then(user=>{
                            requete.flash('success_msg', 'Nouvel usager ajouté à la BD avec succès');
                            reponse.redirect('/listeUsers');
                        })
                        .catch(err=>console.log('insertion dans la bd na pas fonctionnee', err));
                    });
                });
            }
        })
    }
});

//page GET creation user pour le CLIENT
router.get('/ajoutUsagerClient',(requete, reponse)=>{
    const user = requete.user;
    const userLanguage = requete.session.userLanguage || 'fr';
    reponse.render(`ajoutUsagerClient`, {
        'title': 'New User',
        user : user ,
        'translations': reponse.locals.translations[userLanguage],
            });
});
//page POST creation user pour le CLIENT
router.post('/userAddClient',(requete, reponse)=>{
    // input to fill - admin/gestion = role, normal by default
    const {nom, email, password, password2, characterClass} = requete.body;
    const { originalname, destination, filename, size, path, mimetype } = requete.files[0];
    const mimetypePermis=['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];//type valide
    const maxFileSize = 1024*1024*2;//2mo max / img
    console.log('fichier', originalname, destination, filename, size, path, mimetype);
    let errors = [];
    const roles = ["normal"];
  
    if (size > maxFileSize){
        errors.push({msg:`La taille du fichier est trop grande (max ${maxFileSize})`})
    } else {
        if (!mimetypePermis.includes(mimetype)) {
            errors.push({msg: `Format de fichier non accepté (${mimetypePermis})`});
        }
    }
    if (!nom || !email || !password || !password2 || !characterClass){
        errors.push({ msg : 'Remplir toutes les cases du formulaire'});
    }
    if (password !== password2){
        errors.push({ msg: 'Les mots de passe ne correspondent pas'});
    }
    if (password.length < 6){
        errors.push({ msg : 'Le mot de passe doit avoir au moins 6 caractères'});
    }

    if (errors.length > 0){
        //appeler suprimer
        deleteFile(path);
        reponse.render('ajoutUsagerClient',{
            'title': 'Ajout d\'un usager',
            errors : errors,
            nom,
            email,
            password,
            password2,
            characterClass
        });
    } else {
        //verification si email used
        Usagers.findOne({'email': email})
        .then(user=>{
            if(user){//l'usager est déjà connu dans la bd, reject, stop.
            errors.push({ msg: 'Ce courriel est déjà utilisé'});
            //supprimer fichier
            deleteFile(path);
            reponse.render('ajoutUsagerClient',{
                'title': 'Ajout d\'un usager',
                errors : errors,
                nom,
                email,
                password,
                password2,
                characterClass
            });
            } else{
                //next step hashing/add profile -> bd \\ if all gut insert return /village
                let _id = new mongoose.Types.ObjectId();
                const newUser = new Usagers({_id, nom, email, password, roles, characterClass});
                // hachage du mdp
                bcrypt.genSalt(10, (err, salt)=>{
                    if (err) throw err;
                    bcrypt.hash(newUser.password, salt, (err, hash)=>{
                        if (err) throw err;
                        newUser.password = hash;
                        conserverFichier(path, filename);
                        newUser.nomImage = filename;
                        newUser.save()
                        .then(user=>{
                            requete.flash('success_msg', 'Compte crée avec succès');
                            reponse.redirect('/login');
                        })
                        .catch(err=>console.log('insertion dans la bd na pas fonctionnee', err));
                    });
                });
            }
        })
    }
});

// user modifier
router.get('/modifUsager/:email?', isAuthentified, (requete, reponse) => {
    const userLanguage = requete.session.userLanguage || 'fr';
    const user = requete.user;
    const email = requete.params.email || user.email;

    Usagers.findOne({ 'email': email })
        .then(myUser => {
            const admin = myUser.roles.find(elem => elem == "admin");
            const moderateur = myUser.roles.find(elem => elem == "moderateur");

            if (user.roles.includes("admin") || user.email === email) {
                reponse.render('modifUsager', {
                    'title': 'Modification d\'un usager',
                    user: user,
                    nom: myUser.nom,
                    email: myUser.email,
                    admin: admin,
                    moderateur: moderateur,
                    emailREADONLY: true,
                    'translations': reponse.locals.translations[userLanguage],
                });
            } else {
                requete.flash('error_msg', 'Accès non autorisé');
                reponse.redirect('/');
            }
        })
        .catch(err => {
            console.log(err);
            requete.flash('error_msg', 'Erreur interne, contactez l\'administrateur');
            reponse.redirect('/');
        });
});
// user modifier
router.post('/userModif', isAuthentified, (requete, reponse)=>{
    const {nom, email, admin, gestion } = requete.body;
    let errors = [];
    const roles = ["normal"];
    if (admin)
        roles.push("admin");
    if (gestion)
        roles.push("gestion");
    if (!nom ){
        errors.push({ msg : 'Remplir le nom'});
    }
    if (errors.length > 0){
        reponse.render('modifUsager',{
            'title': 'Modification d\'un usager',
            errors : errors,
            nom,
            email,
            admin,
            gestion,
            emailREADONLY: true
        });
    } else {
        const newUser = {nom : nom, roles : roles};
        Usagers.findOneAndUpdate({email : email}, newUser)    
        .then(doc => {
            if (requete.user.roles.includes('admin')) {
                requete.flash('success_msg', 'Usager modifié avec succès');
            } else {
                requete.flash('success_msg', 'Profil modifié avec succès');
            }
            reponse.redirect('/village');
          })
    };
});

// page image user modif
router.get('/editerImage/:email', isAuthentified, (requete, reponse)=>{
    const user = requete.user;
    const email = requete.params.email;
    const userLanguage = requete.session.userLanguage || 'fr';
    Usagers.findOne({'email': email})
    .then(myUser=>{
        console.log('l\adresse email de l\'usager est:', email);
        reponse.render('editerImage', {
            'title': 'Modification d\'une image',
            user : user,
            email : myUser.email,
            nomImage : myUser.nomImage,
            emailREADONLY : true,
            'translations': reponse.locals.translations[userLanguage],
                });
    })
    .catch(err=> {
        console.log(err);
        requete.flash('error_msg', 'Erreur interne, contactez l\'administrateur');
        if (requete.user.roles.includes('admin')) {
            reponse.redirect('/listeUsers');
          } else {
            reponse.redirect('/village');
          }
    });
});
// image user modifier
router.post('/editImage', isAuthentified, (requete, reponse)=>{
    const { email } = requete.body;
    const { originalname, destination, filename, size, path, mimetype } = requete.files[0];
    console.log(
        'verification du nom orignial', originalname,'destination du fichier', destination,'le file name du fichier', filename, 'le size', size,"le path", path,"le mimetype", mimetype
    )
    const mimetypePermis = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    const maxFileSize = 1024 * 1024 * 2;
    let errors = [];

    if (size > maxFileSize){
        errors.push({msg: `La taille du fichier est trop grande (max ${maxFileSize})`});
    } else if (!mimetypePermis.includes(mimetype)) {
        errors.push({msg: `Format de fichier non accepté (${mimetypePermis.join(', ')})`});
    }

    if (errors.length > 0) {
        deleteFile(path);
        reponse.render('editerImage', {
            'title': 'Modification avatar d\'un usager',
            errors: errors,
        });
    } else {
        const user = ({email});
        conserverFichier(path, filename);
        user.nomImage = filename;   
        Usagers.findOneAndUpdate({email : email}, user)
            .then(doc=>{     
                requete.flash('success_msg', 'Votre avatar a été modifié avec succès');
                if (requete.user.roles.includes('admin')) {
                    reponse.redirect('/listeUsers');
                  } else {
                    reponse.redirect('/village');
                  }
                
            })
            .catch(err=>{
                console.log('modification dans la bd na pas fonctionnee', err);
                requete.flash('error_msg', 'Erreur interne, contactez l\'administrateur');
                if (requete.user.roles.includes('admin')) {
                    reponse.redirect('/listeUsers');
                  } else {
                    reponse.redirect('/village');
                  }
            });
    };
});
//----------------------------------------------------------------------------------------------------Get/Post Pour la page MODIFIER PASSWORD
// page pwd user modif
router.get('/editerPWD/:email', isAuthentified, (requete, reponse)=>{
    const userLanguage = requete.session.userLanguage || 'fr';
    const user = requete.user;
    const email = requete.params.email;
    Usagers.findOne({'email': email})
    .then(myUser=>{
        reponse.render('editerPWD', {
            'title': 'Modification d\'une image',
            user : user,
            email : myUser.email,
            newPassword : myUser.newPassword,
            newPassword2 : myUser.newPassword2,
            emailREADONLY: true,
            'translations': reponse.locals.translations[userLanguage],
                });
    })
    .catch(err=> {
        console.log(err);
        requete.flash('error_msg', 'Erreur interne, contactez l\'administrateur');
        if (requete.user.roles.includes('admin')) {
            reponse.redirect('/listeUsers');
          } else {
            reponse.redirect('/village');
          }
    });
});
// page pwd post user modif
router.post('/editPassword', isAuthentified, (requete, reponse) => {
    const {email, newPassword, newPassword2 } = requete.body;
    let errors = [];
    console.log(requete.body);
    // Validation des entrées
    if (!newPassword || !newPassword2) {
        errors.push({ msg: 'Remplir toutes les cases du formulaire' });
    }
    if (newPassword !== newPassword2) {
        errors.push({ msg: 'Les mots de passe ne correspondent pas' });
    }
    if (newPassword.length < 6) {
        errors.push({ msg: 'Le mot de passe doit avoir au moins 6 caractères' });
    }
    
    if (errors.length > 0) {
        reponse.render('editerPWD', {
            'title': 'Modification MDP',
            errors: errors,
            email,
            newPassword,
            newPassword2,
            emailREADONLY : true
        });
    } else {
        const userNewPassword ={password: newPassword}; 
        console.log(userNewPassword);
        bcrypt.genSalt(10, (err, salt)=>{
            if (err) throw err;
            console.log(err);
            bcrypt.hash(userNewPassword.password, salt, (err, hash)=>{
                console.log(userNewPassword.password);console.log(email);
                userNewPassword.password = hash;
                console.log(userNewPassword.password);
                Usagers.findOneAndUpdate({email : email}, userNewPassword)
                    .then(user => {
                        console.log(email);
                    requete.flash('success_msg', 'Le mot de passe a été modifié avec succès !');
                    if (requete.user.roles.includes('admin')) {
                        reponse.redirect('/listeUsers');
                      } else {
                        reponse.redirect('/village');
                      }
                    })
                    .catch(err=>{
                    console.log('modification dans la bd na pas fonctionnee', err);
                    requete.flash('error_msg', 'Erreur interne, contactez l\'administrateur');
                    if (requete.user.roles.includes('admin')) {
                        reponse.redirect('/listeUsers');
                      } else {
                        reponse.redirect('/village');
                      }
                    });
                });
        });
    }
});

// Inventaire de l'usager
router.get('/inventaire', isAuthentified, (requete, reponse) => {
    const userLanguage = requete.session.userLanguage || 'fr';
    Usagers.findOne({ email: requete.session.passport.user })
    .populate('inventaire.item')
    .then(user => {
        if (!user) {
            throw new Error('Utilisateur non trouvé');
        }
        reponse.render('inventaire', {
            user: user,
            items: user.inventaire,
            'translations': reponse.locals.translations[userLanguage],
        });
    })
    .catch(err => {
        console.error(err);
        reponse.status(500).send('Erreur lors de la récupération de l\'inventaire.');
    });
});


// ---------------------------------------------------------------------------------------------------------------DELETE
router.get('/deleteUser/:email', isAdmin, (requete, reponse)=>{
    const user = requete.user;
    const email = requete.params.email;
    Usagers.deleteOne({'email': email})
    .exec()
    .then(result => {
        console.log(result);
        requete.flash('success_msg', 'Usager supprimé avec succès'); // Ajouté ici
        reponse.redirect('/listeUsers');
    })
    .catch(err => {
        console.log(err);
        requete.flash('error_msg', 'Une erreur s\'est produite lors de la suppression'); // Ajouté ici en cas d'erreur
        reponse.redirect('/listeUsers');
    });
});


/**
 * La fonction conserverFichier deplace le fichier a conserver dans le 
 * repertoir des images statiques et retourne le nom du fichier a mettre
 * dans la bd
 * @param {*} nomFichier = le fichier original a deplacer avec son chemin
 * @param {*} filename = le nom du fichier a conserver dans le dossier static
 */
const conserverFichier = async (nomFichier, filename) => {
    const nomFichierComplet = nodeJSpath.join(__dirname, '..', nomFichier);
    const nouveauNom = nodeJSpath.join(__dirname, '..', 'static', 'images', filename);
    try {
        await fs.rename(nomFichierComplet, nouveauNom);
    } catch (err) {
        console.log(err);
    }
}
/**
 * Fonction deleteFile qui est utilisée pour supprimer un fichier
 * 
 * @param {*} nomFichier nom du fichier a del 
 */
const deleteFile = async (nomFichier)=>{
    const nomFichierComplet = nodeJSpath.join(__dirname, '..', nomFichier);
    try {
    await fs.rm(nomFichierComplet);
    } catch (err) {
        console.log(err)
    }
}

module.exports = router;