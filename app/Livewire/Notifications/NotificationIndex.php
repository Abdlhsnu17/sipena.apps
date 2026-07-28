<?php

namespace App\Livewire\Notifications;

use App\Models\Notification;
use Livewire\Attributes\Layout;
use Livewire\Component;
use Livewire\WithPagination;

#[Layout('layouts.app')]
class NotificationIndex extends Component
{
    use WithPagination;

    public function markRead(int $id)
    {
        Notification::where('id', $id)->where('user_id', auth()->id())->update([
            'is_read' => true,
            'read_at' => now(),
        ]);
    }

    public function render()
    {
        $notifications = Notification::where('user_id', auth()->id())
            ->orderByDesc('created_at')
            ->paginate(20);

        return view('livewire.notifications.notification-index', compact('notifications'));
    }
}
