import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { FormGroup, FormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { FeatherModule } from "angular-feather"

import { CognitoServiceService } from 'src/app/services/auth/cognito-service.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule, FeatherModule],
  templateUrl: './login.component.html',
})
export class AppLoginComponent {
  options = this.settings.getOptions();

  constructor(private settings: CoreService, private authService: CognitoServiceService) { }

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  submit() {
    if (this.form.valid) {
      this.authService.login(this.form.value.email, this.form.value.password)
    } else {
      console.log('Usuario incorrecto')
    }
    // this.router.navigate(['/dashboards/dashboard1']);
  }
}
