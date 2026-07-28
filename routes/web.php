<?php

use App\Http\Controllers\Auth\LogoutController;
use App\Livewire\Auth\ForceChangePassword;
use App\Livewire\Auth\ForgotPassword;
use App\Livewire\Auth\Login;
use App\Livewire\Auth\Register;
use App\Livewire\Auth\ResetPassword;
use App\Livewire\Dashboard;
use App\Livewire\Notifications\NotificationIndex;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', Login::class)->name('login');
    Route::get('/register', Register::class)->name('register');
    Route::get('/forgot-password', ForgotPassword::class)->name('password.request');
    Route::get('/reset-password/{nip?}', ResetPassword::class)->name('password.reset');
});

Route::middleware('auth')->group(function () {
    Route::get('/password/force-change', ForceChangePassword::class)->name('password.force-change');
    Route::post('/logout', LogoutController::class)->name('logout');

    Route::get('/', Dashboard::class)->name('dashboard');
    Route::get('/notifications', NotificationIndex::class)->name('notifications.index');
});
