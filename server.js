const WebSocket = require("ws");

// Objeto para armazenar salas e slots ocupados
const rooms = {};

const wss = new WebSocket.Server({ port: 8080 });

// Tratamento de conexão de WebSocket
wss.on("connection", function connection(ws) {
  let roomId;

  // Evento de recebimento de mensagem
  ws.on("message", function incoming(message) {
    const data = JSON.parse(message);
    const { action, slotId } = data;

    console.log("Received message:", data);

    // Switch para tratar diferentes ações
    switch (action) {
      // Caso para usuário entrar na sala
      case "join":
        roomId = data.roomId;
        // Verifica se a sala existe, senão cria
        if (!rooms[roomId]) {
          rooms[roomId] = { members: new Set(), occupiedSlots: new Set() };
        }
        // Adiciona o usuário à sala
        rooms[roomId].members.add(ws);
        console.log(`User joined room ${roomId}`);
        // Envia slots ocupados para o usuário recém-conectado
        if (rooms[roomId].occupiedSlots.size > 0) {
          ws.send(JSON.stringify({ action: "showOccupiedSlots", slots: Array.from(rooms[roomId].occupiedSlots) }));
        }
        // Envia confirmação de entrada na sala com slots ocupados para o usuário
        ws.send(JSON.stringify({ action: "joinRoomSuccess", roomId, slots: Array.from(rooms[roomId].occupiedSlots) }));
        break;
      // Caso para clicar em um slot
      case "clickSlot":
        if (roomId && rooms[roomId]) {
          // Verifica se o slot está ocupado
          if (!rooms[roomId].occupiedSlots.has(slotId)) {
            // Marca o slot como ocupado e envia a mensagem para a sala
            rooms[roomId].occupiedSlots.add(slotId);
            broadcast(roomId, { action: "slotOccupied", slotId });
            console.log(`Slot ${slotId} marked as occupied`);
          } else {
            console.log(`Slot ${slotId} is already occupied`);
          }
        }
        break;
      // Caso para completar um atendimento e liberar o slot
      case "completeAppointment":
        if (roomId && rooms[roomId]) {
          // Remove o slot ocupado e envia a mensagem para a sala
          rooms[roomId].occupiedSlots.delete(slotId);
          broadcast(roomId, { action: "slotFreed", slotId });
          console.log(`Slot ${slotId} marked as freed`);
        }
        break;
    }
  });

  // Evento de fechamento da conexão WebSocket
  ws.on("close", function () {
    if (roomId && rooms[roomId]) {
      // Remove o usuário da sala
      rooms[roomId].members.delete(ws);
      // Se não houver mais membros na sala, a sala é excluída
      if (rooms[roomId].members.size === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} has no more members and was deleted`);
      }
    }
  });
});

// Função para enviar uma mensagem para todos os membros de uma sala
function broadcast(roomId, message) {
  if (rooms[roomId]) {
    rooms[roomId].members.forEach(function each(member) {
      if (member.readyState === WebSocket.OPEN) {
        member.send(JSON.stringify(message));
      }
    });
  }
}
