import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { FormGroup, FormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { FeatherModule } from "angular-feather"

import { CognitoServiceService } from 'src/app/services/auth/cognito-service.service';
import { UserService } from 'src/app/services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule, FeatherModule],
  templateUrl: './login.component.html',
})
export class AppLoginComponent {
  options = this.settings.getOptions();

  constructor(private settings: CoreService, private authService: CognitoServiceService,
    private userService: UserService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) { }

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }


  async ngOnInit() {

    // Verificar si acabamos de hacer logout
    const logoutInProgress = sessionStorage.getItem('logout_in_progress');
    if (logoutInProgress === 'true') {
      console.log('Logout detectado en login component, limpiando...');
      sessionStorage.removeItem('logout_in_progress');
      
      // Limpiar el code de la URL si existe
      if (window.location.search.includes('code=')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      return; // No continuar con el flujo de autenticación
    }

    // this.loading = true;
    await this.userService.socialSignInListener();

    try {
      const authenticated = await this.userService.isAuthenticatedUser();
      const userattributes = await this.userService.getUserClaims();
      if (userattributes) {

        const gln: string = userattributes["custom:userOwnershipData"] as string;
        const glnparts = gln.split('|');

        localStorage.setItem('gln', glnparts[0]);

        // roles
        const rolesRaw = userattributes["custom:userRole"] as string;
        const roles = rolesRaw
          ? rolesRaw.replace(/^\[|\]$/g, '')
            .split(',')
            .map(role => role.trim().replace(/^['"]|['"]$/g, ''))
          : [];
        localStorage.setItem('roles', JSON.stringify(roles));

        // const allowedRoles = ['systemadmin', 'admin'];

        const exactAllowedRoles = ['systemadmin', 'admin'];
        const partialKeywords = ['retailer', 'premiummanufacturer'];

        const normalizedRoles = roles.map(role => role.toLowerCase());

        const hasAllowedRole = normalizedRoles.some(
          role =>
            exactAllowedRoles.includes(role) ||
            partialKeywords.some(keyword => role.includes(keyword))
        );

        // const hasAllowedRole = roles.some(role => allowedRoles.includes(role));
        if (!hasAllowedRole) {
          this.snackBar.open('Acceso denegado. Su cuenta no tiene permisos para acceder.', 'Cerrar', {
            duration: 9000,
            panelClass: ['snackbar-warn']
          });
          
          // Usar logoutAndRedirect para cerrar sesión completamente y redirigir
          await this.userService.logoutAndRedirect('https://psi.gs1mexico.org/');
          return;
        }
      }


      if (authenticated) {
        this.router.navigate(['/home']);
      } else {

        await this.onSubmit();
      }
    } catch (err) {
      console.error('err:', err);
    } finally {
      // this.loading = false;
    }
  }

  submit() {
    if (this.form.valid) {
      this.authService.login(this.form.value.email, this.form.value.password)
    } else {
      //('Usuario incorrecto')
    }
    // this.router.navigate(['/home']);
  }


  async onSubmit() {
    // let corporation1 = {} as Corporation;


    // this.corporation = corporation1;
    const email = '';
    const password = '';

    //(this.userService.isAuthenticated());
    this.userService.socialSignIn("auth0IdP", email, password).then(
      (auth) => {
        //(auth)
        // this.loading = false;
      }
    ).catch(
      (err) => {
        //(err)
        // this.loading = false;
      }
    ).finally(
      () => {
        // this.loading = false;
      }
    );
  }

}
