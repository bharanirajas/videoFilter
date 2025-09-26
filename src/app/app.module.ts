import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { QRCodeComponent } from 'angularx-qrcode';
import { NgxQrcodeStylingComponent } from 'ngx-qrcode-styling';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    QRCodeComponent,
    NgxQrcodeStylingComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
