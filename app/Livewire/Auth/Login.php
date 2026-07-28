<?php

namespace App\Livewire\Auth;

use App\Services\AuthService;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.guest')]
class Login extends Component
{
    public string $identifier = '';
    public string $password = '';
    public bool $remember = false;

    public function submit(AuthService $authService)
    {
        $this->validate([
            'identifier' => ['required', 'string'],
            'password' => ['required', 'string'],
        ], [], ['identifier' => 'NIP atau email']);

        $result = $authService->attemptLogin($this->identifier, $this->password);

        if (!$result['success']) {
            $this->addError('identifier', $result['message']);

            return;
        }

        $user = $result['user'];

        auth()->login($user, $this->remember);
        session(['session_version' => $user->session_version]);
        request()->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    public function render()
    {
        return view('livewire.auth.login');
    }
}
