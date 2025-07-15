import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { FormGroup, FormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { FeatherModule } from "angular-feather"

import { CognitoServiceService } from 'src/app/services/auth/cognito-service.service';
import { UserService } from 'src/app/services/user.service';

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
  ) { }

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }


  async ngOnInit() {

    // this.loading = true;
    await this.userService.socialSignInListener();
      
    try {
      const authenticated = await this.userService.isAuthenticatedUser();
      const userattributes = await this.userService.getUserClaims();
      if (userattributes) {
        //(userattributes);
        //(userattributes["custom:userOwnershipData"]);
        //(userattributes["custom:userFirstName"]);
        //(userattributes["custom:userLastName"]);
      }


      if (authenticated) {
        this.router.navigate(['/dashboards/dashboard1']);
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
    // this.router.navigate(['/dashboards/dashboard1']);
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
